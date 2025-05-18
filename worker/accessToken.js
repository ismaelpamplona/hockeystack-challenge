const hubspot = require('@hubspot/api-client');
const hubspotClient = new hubspot.Client({ accessToken: '' });
let expirationDate;

const refreshAccessToken = async (domain, hubId) => {
  const { HUBSPOT_CID, HUBSPOT_CS } = process.env;
  const account = domain.integrations.hubspot.accounts.find(acc => acc.hubId === hubId);
  const { accessToken, refreshToken } = account;

  const result = await hubspotClient.oauth.tokensApi.createToken(
    'refresh_token',
    undefined,
    undefined,
    HUBSPOT_CID,
    HUBSPOT_CS,
    refreshToken
  );

  const body = result.body || result;
  const newAccessToken = body.accessToken;
  expirationDate = new Date(body.expiresIn * 1000 + new Date().getTime());

  hubspotClient.setAccessToken(newAccessToken);
  if (newAccessToken !== accessToken) {
    account.accessToken = newAccessToken;
  }

  return true;
};

module.exports = { refreshAccessToken, expirationDate, hubspotClient };
