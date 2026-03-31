const request = require('supertest');
const express = require('express');

jest.mock('../services/notify', () => ({
  notifyStageChange: jest.fn().mockResolvedValue(true)
}));
jest.mock('../services/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const bitrixWebhookRouter = require('../webhook/bitrixWebhook');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/webhook/bitrix', bitrixWebhookRouter);

describe('Bitrix Webhook', () => {
  it('should return 200 for health check', async () => {
    const res = await request(app).get('/webhook/bitrix');
    expect(res.statusCode).toBe(200);
  });

  it('should process webhook event', async () => {
    const res = await request(app).post('/webhook/bitrix').send({
      event: 'ONCRMDEALADD',
      data: { FIELDS: { ID: 1, STAGE_ID: 'NEW' } }
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
