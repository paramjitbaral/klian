const express = require('express');
const app = express();

const m1 = (req, res, next) => { console.log('m1'); req.m1 = true; next(); };
const m2 = (req, res, next) => { console.log('m2'); req.m2 = true; next(); };

const mwArray = [m1, m2];

app.post('/test', mwArray, (req, res) => {
  res.json({ ok: true, m1: req.m1, m2: req.m2 });
});

app.post('/test2', m1, mwArray, (req, res) => {
  res.json({ ok: true, m1: req.m1, m2: req.m2 });
});

const request = require('supertest');
request(app).post('/test').expect(200).then(res => console.log('/test:', res.body))
  .then(() => request(app).post('/test2').expect(200).then(res => console.log('/test2:', res.body)));
