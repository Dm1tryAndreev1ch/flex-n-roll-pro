const { callBitrix } = require('./webhook/src/services/bitrix');
callBitrix('crm.status.list', { filter: { ENTITY_ID: 'DEAL_STAGE' } })
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(err => console.error(err));
