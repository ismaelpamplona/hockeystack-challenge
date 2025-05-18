const { createQueue, drainQueue } = require('./queue');
const { refreshAccessToken } = require('./accessToken');
const { processCompanies } = require('./companies');
const { processContacts } = require('./contacts');
const { processMeetings } = require('./meetings');
const { saveDomain } = require('./domain');
const Domain = require('../Domain');

const pullDataFromHubspot = async () => {
  console.log('[System] Starting HubSpot sync...');

  const domain = await Domain.findOne({});

  for (const account of domain.integrations.hubspot.accounts) {
    console.log(`[System] Processing HubSpot account: hubId=${account.hubId}`);

    try {
      await refreshAccessToken(domain, account.hubId);
      console.log('[Auth] Access token refreshed.');
    } catch (err) {
      console.error('[Auth] Failed to refresh access token:', err);
    }

    const actions = [];
    const q = createQueue(domain, actions);

    try {
      console.log(`[HubSpot] Starting contact sync for hubId: ${account.hubId}`);
      await processContacts(domain, account.hubId, q);
      console.log('[HubSpot] Contact sync completed.');
    } catch (err) {
      console.error('[HubSpot] Error during contact sync:', err);
    }

    try {
      console.log(`[HubSpot] Starting company sync for hubId: ${account.hubId}`);
      await processCompanies(domain, account.hubId, q);
      console.log('[HubSpot] Company sync completed.');
    } catch (err) {
      console.error('[HubSpot] Error during company sync:', err);
    }

    try {
      console.log(`[HubSpot] Starting meeting sync for hubId: ${account.hubId}`);
      await processMeetings(domain, account.hubId, q);
      console.log('[HubSpot] Meeting sync completed.');
    } catch (err) {
      console.error('[HubSpot] Error during meeting sync:', err);
    }

    try {
      console.log('[Queue] Draining remaining actions...');
      await drainQueue(domain, actions, q);
      console.log('[Queue] Draining completed.');
    } catch (err) {
      console.error('[Queue] Error while draining actions:', err);
    }

    await saveDomain(domain);
    console.log(`[System] Finished processing hubId: ${account.hubId}`);
  }

  console.log('[System] HubSpot sync completed for all accounts.');
  process.exit();
};

module.exports = pullDataFromHubspot;
