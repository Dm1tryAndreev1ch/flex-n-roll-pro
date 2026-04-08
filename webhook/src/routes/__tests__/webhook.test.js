const request = require('supertest');

// Set test env vars before importing app/config
process.env.BITRIX_WEBHOOK_URL = 'https://test.bitrix24.ru/rest/1/test-token/';
process.env.BITRIX_PORTAL_DOMAIN = 'test.bitrix24.ru';

const app = require('../../server');

jest.mock('../../services/lmstudio', () => ({
  classifyMessage: jest.fn(),
}));

jest.mock('../../services/bitrix', () => ({
  updateLead: jest.fn(),
  createTask: jest.fn(),
  sendMessage: jest.fn(),
  calculateDeadline: jest.fn().mockReturnValue(new Date()),
}));

jest.mock('../../services/routing', () => ({
  getNextManager: jest.fn().mockResolvedValue(1),
  resolvePool: jest.fn().mockReturnValue('sales'),
  buildTaskTitle: jest.fn().mockReturnValue('Test Title'),
  buildTaskDescription: jest.fn().mockReturnValue('Test Desc'),
}));

const lmstudio = require('../../services/lmstudio');
const bitrix = require('../../services/bitrix');

describe('Webhook Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    lmstudio.classifyMessage.mockResolvedValue({
      intent: 'quote_request',
      product_type: 'wide_format',
      urgency: 'high',
      route_to: 'sales',
      priority: 2,
      auto_reply: 'Got it.',
      extracted_data: { contact_name: 'Test' },
    });
  });

  it('should return 200 OK immediately and process onCrmLeadAdd in background', async () => {
    const res = await request(app)
      .post('/webhook')
      .type('form')
      .send({
        event: 'ONCRMLEADADD',
        auth: { domain: 'test.bitrix24.ru' },
        data: { FIELDS: { ID: '123', COMMENTS: 'Test lead msg' } },
      });

    expect(res.statusCode).toEqual(200);
    expect(res.text).toEqual('ok');

    await new Promise(process.nextTick);

    expect(lmstudio.classifyMessage).toHaveBeenCalledTimes(1);
    expect(bitrix.updateLead).toHaveBeenCalledTimes(1);
    expect(bitrix.createTask).toHaveBeenCalledTimes(1);
  });

  it('should fail with 401 if auth.domain is missing', async () => {
    const res = await request(app)
      .post('/webhook')
      .type('form')
      .send({ event: 'ONCRMLEADADD' });

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toBe('Unauthorized: missing auth domain');
  });

  it('should fail with 401 if auth.domain does not match', async () => {
    const res = await request(app)
      .post('/webhook')
      .type('form')
      .send({
        event: 'ONCRMLEADADD',
        auth: { domain: 'evil.bitrix24.ru' },
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toBe('Unauthorized: domain mismatch');
  });

  it('should process onImConnectorMessageAdd correctly', async () => {
    const res = await request(app)
      .post('/webhook')
      .type('form')
      .send({
        event: 'ONIMCONNECTORMESSAGEADD',
        auth: { domain: 'test.bitrix24.ru' },
        data: {
          PARAMS: { MESSAGE: 'Hello from telegram', CRM_ENTITY_ID: '123', DIALOG_ID: 'chat123' },
          USER: { NAME: 'Test User' },
        },
      });

    expect(res.statusCode).toEqual(200);

    await new Promise(process.nextTick);

    expect(lmstudio.classifyMessage).toHaveBeenCalledTimes(1);
    expect(bitrix.sendMessage).toHaveBeenCalledTimes(1);
    expect(bitrix.sendMessage).toHaveBeenCalledWith('chat123', 'Got it.');
  });
});
