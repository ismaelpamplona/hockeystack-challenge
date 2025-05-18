const { hubspotClient, expirationDate, refreshAccessToken } = require('./accessToken');
const { generateLastModifiedDateFilter } = require('./filters');
const { saveDomain } = require('./domain');

const processCompanies = async (domain, hubId, q) => {
  const account = domain.integrations.hubspot.accounts.find(a => a.hubId === hubId);
  const lastPulledDate = new Date(account.lastPulledDates.companies);
  const now = new Date();

  let hasMore = true;
  const offsetObject = {};
  const limit = 100;
  let totalFound = 0;

  while (hasMore) {
    const lastModifiedDate = offsetObject.lastModifiedDate || lastPulledDate;
    const searchObject = {
      filterGroups: [generateLastModifiedDateFilter(lastModifiedDate, now)],
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
      properties: ['name', 'domain', 'country', 'industry', 'description', 'annualrevenue', 'numberofemployees', 'hs_lead_status'],
      limit,
      after: offsetObject.after
    };

    let searchResult;
    let tryCount = 0;

    while (tryCount <= 4) {
      try {
        searchResult = await hubspotClient.crm.companies.searchApi.doSearch(searchObject);
        break;
      } catch (err) {
        tryCount++;
        if (new Date() > expirationDate) await refreshAccessToken(domain, hubId);
        await new Promise(resolve => setTimeout(resolve, 5000 * 2 ** tryCount));
      }
    }

    if (!searchResult) throw new Error('Failed to fetch companies after 4 retries.');

    const data = searchResult.results || [];
    totalFound += data.length;
    offsetObject.after = parseInt(searchResult.paging?.next?.after);
    console.log('fetch company batch');

    data.forEach(company => {
      if (!company.properties) return;

      const isCreated = !lastPulledDate || (new Date(company.createdAt) > lastPulledDate);

      q.push({
        actionName: isCreated ? 'Company Created' : 'Company Updated',
        actionDate: new Date(isCreated ? company.createdAt : company.updatedAt) - 2000,
        includeInAnalytics: 0,
        companyProperties: {
          company_id: company.id,
          company_domain: company.properties.domain,
          company_industry: company.properties.industry
        }
      });
    });

    if (!offsetObject?.after) {
      hasMore = false;
    } else if (offsetObject?.after >= 9900) {
      offsetObject.after = 0;
      offsetObject.lastModifiedDate = new Date(data[data.length - 1].updatedAt).valueOf();
    }
  }

  account.lastPulledDates.companies = now;
  await saveDomain(domain);
  console.log(`Fetched ${totalFound} companies`);
};

module.exports = { processCompanies };
