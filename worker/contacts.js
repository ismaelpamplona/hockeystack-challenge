const { hubspotClient, expirationDate, refreshAccessToken } = require('./accessToken');
const { generateLastModifiedDateFilter } = require('./filters');
const { filterNullValuesFromObject } = require('../utils');
const { saveDomain } = require('./domain');

const processContacts = async (domain, hubId, q) => {
  const account = domain.integrations.hubspot.accounts.find(a => a.hubId === hubId);
  const lastPulledDate = new Date(account.lastPulledDates.contacts);
  const now = new Date();

  let hasMore = true;
  const offsetObject = {};
  const limit = 100;
  let totalFound = 0;

  while (hasMore) {
    const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;
    const searchObject = {
      filterGroups: [generateLastModifiedDateFilter(lastModifiedDate, now, 'lastmodifieddate')],
      sorts: [{ propertyName: 'lastmodifieddate', direction: 'ASCENDING' }],
      properties: [
        'firstname', 'lastname', 'jobtitle', 'email',
        'hubspotscore', 'hs_lead_status',
        'hs_analytics_source', 'hs_latest_source'
      ],
      limit,
      after: offsetObject.after
    };

    let searchResult;
    let tryCount = 0;

    while (tryCount <= 4) {
      try {
        searchResult = await hubspotClient.crm.contacts.searchApi.doSearch(searchObject);
        break;
      } catch (err) {
        tryCount++;
        if (new Date() > expirationDate) await refreshAccessToken(domain, hubId);
        await new Promise(resolve => setTimeout(resolve, 5000 * 2 ** tryCount));
      }
    }

    if (!searchResult) throw new Error('Failed to fetch contacts after 4 retries.');

    const data = searchResult.results || [];
    totalFound += data.length;
    offsetObject.after = parseInt(searchResult.paging?.next?.after);
    console.log('fetch contact batch');

    const contactIds = data.map(c => c.id);
    const assocResults = await (await hubspotClient.apiRequest({
      method: 'post',
      path: '/crm/v3/associations/CONTACTS/COMPANIES/batch/read',
      body: { inputs: contactIds.map(id => ({ id })) }
    })).json();

    const companyAssociations = Object.fromEntries(
      assocResults.results.map(a => a.from && a.to?.length ? [a.from.id, a.to[0].id] : []).filter(Boolean)
    );

    data.forEach(contact => {
      if (!contact.properties?.email) return;

      const isCreated = new Date(contact.createdAt) > lastPulledDate;

      q.push({
        actionName: isCreated ? 'Contact Created' : 'Contact Updated',
        actionDate: new Date(isCreated ? contact.createdAt : contact.updatedAt),
        includeInAnalytics: 0,
        identity: contact.properties.email,
        userProperties: filterNullValuesFromObject({
          company_id: companyAssociations[contact.id],
          contact_name: `${contact.properties.firstname || ''} ${contact.properties.lastname || ''}`.trim(),
          contact_title: contact.properties.jobtitle,
          contact_source: contact.properties.hs_analytics_source,
          contact_status: contact.properties.hs_lead_status,
          contact_score: parseInt(contact.properties.hubspotscore) || 0
        })
      });
    });

    if (!offsetObject?.after) {
      hasMore = false;
    } else if (offsetObject?.after >= 9900) {
      offsetObject.after = 0;
      offsetObject.lastModifiedDate = new Date(data[data.length - 1].updatedAt).valueOf();
    }
  }

  account.lastPulledDates.contacts = now;
  await saveDomain(domain);
  console.log(`Fetched ${totalFound} contacts`);
};

const fetchContactsByIds = async contactIds => {
  const result = await (await hubspotClient.apiRequest({
    method: 'post',
    path: '/crm/v3/objects/contacts/batch/read',
    body: {
      properties: ['email'],
      inputs: contactIds.map(id => ({ id }))
    }
  })).json();

  return result?.results || [];
};

module.exports = { processContacts, fetchContactsByIds };
