const { hubspotClient, expirationDate, refreshAccessToken } = require('./accessToken');
const { fetchContactsByIds } = require('./contacts');
const { saveDomain } = require('./domain');

const processMeetings = async (domain, hubId, q) => {
  const account = domain.integrations.hubspot.accounts.find(acc => acc.hubId === hubId);
  const lastPulledDate = new Date(account.lastPulledDates.meetings);
  const now = new Date();

  let hasMore = true;
  const offsetObject = { offset: 0 };
  let totalFound = 0;

  while (hasMore) {
    let searchResult;
    let tryCount = 0;

    while (tryCount <= 4) {
      try {
        const response = await (await hubspotClient.apiRequest({
          method: 'get',
          path: '/engagements/v1/engagements/paged',
          qs: { limit: 100, offset: offsetObject.offset }
        })).json();

        searchResult = {
          results: response.results?.filter(e => e.engagement?.type === 'MEETING'),
          offset: response.offset,
          hasMore: response.hasMore
        };

        break;
      } catch (err) {
        tryCount++;
        if (new Date() > expirationDate) await refreshAccessToken(domain, hubId);
        await new Promise(resolve => setTimeout(resolve, 5000 * 2 ** tryCount));
      }
    }

    if (!searchResult) throw new Error('Failed to fetch meetings after 4 retries.');

    const data = searchResult.results || [];
    totalFound += data.length;
    console.log(`[HubSpot] Fetched ${data.length} meetings (batch)`);

    const meetingIds = data.map(m => m.engagement.id);
    const contactAssoc = await (await hubspotClient.apiRequest({
      method: 'post',
      path: '/crm/v3/associations/engagements/contacts/batch/read',
      body: { inputs: meetingIds.map(id => ({ id })) }
    })).json();

    const meetingToContact = Object.fromEntries(
      contactAssoc.results.filter(r => r.from?.id && r.to?.length).map(r => [r.from.id, r.to[0].id])
    );

    const contactIds = [...new Set(Object.values(meetingToContact))];
    const contactDetails = await fetchContactsByIds(contactIds);
    const contactEmails = Object.fromEntries(contactDetails.map(c => [c.id, c.properties?.email]));

    data.forEach(meeting => {
      const meetingId = meeting.engagement.id;
      const contactId = meetingToContact[meetingId];
      const email = contactEmails[contactId];
      if (!email) {
        console.warn(`[Warning] Skipped meetingId: ${meetingId} – no email for contactId: ${contactId}`);
        return;
      }

      const createdAt = new Date(meeting.engagement.createdAt);
      const updatedAt = new Date(meeting.engagement.lastUpdated);
      const isCreated = createdAt > lastPulledDate;

      q.push({
        actionName: isCreated ? 'Meeting Created' : 'Meeting Updated',
        actionDate: isCreated ? createdAt : updatedAt,
        includeInAnalytics: 0,
        identity: email,
        meetingProperties: {
          title: meeting.metadata?.title,
          body: meeting.metadata?.body,
          start_time: meeting.metadata?.startTime,
          end_time: meeting.metadata?.endTime
        }
      });
    });

    offsetObject.offset = searchResult.offset;
    hasMore = searchResult.hasMore;
  }

  account.lastPulledDates.meetings = now;
  await saveDomain(domain);
  console.log(`[HubSpot] Total meetings processed: ${totalFound}`);
};

module.exports = { processMeetings };
