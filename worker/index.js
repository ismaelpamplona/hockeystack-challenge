const { createQueue, drainQueue } = require('./queue');
const { refreshAccessToken } = require('./accessToken');
const { processCompanies } = require('./companies');
const { processContacts } = require('./contacts');
const { processMeetings } = require('./meetings');
const { saveDomain } = require('./domain');
const Domain = require('../Domain');
const _ = require('lodash');
const { goal } = require('../utils');

const pullDataFromHubspot = async () => {
  console.log('start pulling data from HubSpot');
  const domain = await Domain.findOne({});

  for (const account of domain.integrations.hubspot.accounts) {
    console.log('start processing account');

    try {
      await refreshAccessToken(domain, account.hubId);
    } catch (err) {
      console.log(err);
    }

    const actions = [];
    const q = createQueue(domain, actions);

    try {
      await processContacts(domain, account.hubId, q);
      console.log('process contacts');
    } catch (err) {
      console.log(err);
    }

    try {
      await processCompanies(domain, account.hubId, q);
      console.log('process companies');
    } catch (err) {
      console.log(err);
    }

    try {
      await processMeetings(domain, account.hubId, q);
      console.log('process meetings');
    } catch (err) {
      console.log(err);
    }

    try {
      await drainQueue(domain, actions, q);
      console.log('drain queue');
    } catch (err) {
      console.log(err);
    }

    await saveDomain(domain);
    console.log('finish processing account');
  }

  process.exit();
};

module.exports = pullDataFromHubspot;
