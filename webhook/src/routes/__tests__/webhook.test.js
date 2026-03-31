const request = require('supertest');
const crypto = require('crypto');
const app = require('../../server'); // The Express app
const config = require('../../../config/config');

// We need to mock the services
jest.mock('../../services/lmstudio', () => ({
  classifyMessage: jest.fn(),
}));

jest.mock('../../services/bitrix', () => ({
  updateLead: jest.fn(),
  createTask: jest.fn(),
  sendImMessage: jest.fn(),
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
    
    // Default LM Studio mock output
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

  const generateSignature = (payload) => {
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    return crypto.createHmac('sha256', config.webhook.secret).update(rawBody).digest('hex');
  };

  it('should return 200 OK immediately and process onCrmLeadAdd in background', async () => {
    const payload = {
      event: 'ONCRMLEADADD',
      data: { FIELDS: { ID: 123, COMMENTS: 'Test lead msg' } }
    };
    
    const signature = generateSignature(payload);

    const res = await request(app)
      .post('/webhook')
      .set(config.webhook.signatureHeader, signature)
      .send(payload);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({ ok: true });

    // Let the event loop cycle so the async background handler finishes
    await new Promise(process.nextTick);

    expect(lmstudio.classifyMessage).toHaveBeenCalledTimes(1);
    expect(bitrix.updateLead).toHaveBeenCalledTimes(1);
    expect(bitrix.createTask).toHaveBeenCalledTimes(1);
  });

  it('should fail with 401 if missing signature header', async () => {
    const payload = { event: 'ONCRMLEADADD' };
    const res = await request(app)
      .post('/webhook')
      .send(payload);

    expect(res.statusCode).toEqual(401);
    expect(res.body.error).toBe('Missing signature header');
  });

  it('should process onImConnectorMessageAdd correctly', async () => {
    const payload = {
      event: 'ONIMCONNECTORMESSAGEADD',
      data: { MESSAGE: 'Hello from telegram', CRM_ENTITY_ID: 123, DIALOG_ID: 'chat123' }
    };

    const signature = generateSignature(payload);

    const res = await request(app)
      .post('/webhook')
      .set(config.webhook.signatureHeader, signature)
      .send(payload);

    expect(res.statusCode).toEqual(200);

    await new Promise(process.nextTick);

    expect(lmstudio.classifyMessage).toHaveBeenCalledTimes(1);
    expect(bitrix.sendImMessage).toHaveBeenCalledTimes(1);
    // Since auto_reply is output by our mock, it should send it back
    expect(bitrix.sendImMessage).toHaveBeenCalledWith('chat123', 'Got it.');
  });
});
