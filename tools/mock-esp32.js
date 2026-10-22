// Pretends to be the ESP32 so you can test the app's real Wi-Fi connection without hardware.
//   npm run mock                      -> normal readings
//   npm run mock -- --scenario danger -> gas DANGER + raining
//   npm run mock -- --scenario invalid-> TDS probe reports an invalid reading
// Then enter this PC's IP and port 8080 in the app. Press Ctrl+C to simulate the ESP32 going offline.
const http = require('http');
const os = require('os');

const args = process.argv.slice(2);
const PORT = Number(process.env.PORT) || Number(args[args.indexOf('--port') + 1]) || 8080;
let scenario = args.includes('--scenario') ? args[args.indexOf('--scenario') + 1] : 'normal';
const start = Date.now();

let rain = 8, tds = 214, gas = 18;
let motion = false, count = 0, lastMotion = null, motionUntil = 0;
const events = []; // { start, end }
const hist = { rain: [], tds: [], gas: [], motion: [] };
let lastHist = Date.now();
let motionSinceSample = false;

const drift = (v, step, lo, hi) => Math.min(hi, Math.max(lo, v + (Math.random() - 0.5) * step));
const target = () => (scenario === 'danger' ? { rain: 78, tds: 342, gas: 72 } : { rain: 8, tds: 214, gas: 18 });

// Pre-fill an hour of history so the app's charts are full straight away.
for (let i = 720; i > 0; i--) {
  hist.rain.push(Math.round(8 + Math.random() * 4));
  hist.tds.push(Math.round(210 + Math.random() * 12));
  hist.gas.push(Math.round(16 + Math.random() * 5));
  const m = Math.random() < 0.03 ? 1 : 0;
  hist.motion.push(m);
  if (m) events.push({ start: Date.now() - i * 5000, end: Date.now() - i * 5000 + 4000 + Math.random() * 8000 });
}

setInterval(() => {
  const t = target();
  rain = drift(rain + (t.rain - rain) * 0.05, 3, 0, 100);
  tds = drift(tds + (t.tds - tds) * 0.05, 6, 0, 1000);
  gas = drift(gas + (t.gas - gas) * 0.05, 2.5, 0, 100);
  // Occasional visits: motion starts rarely and lasts 3–15 s.
  const next = motion ? Date.now() < motionUntil : Math.random() < 0.004;
  if (next && !motion) {
    motionUntil = Date.now() + 3000 + Math.random() * 12000;
    count++;
    events.push({ start: Date.now(), end: null });
  }
  if (!next && motion && events.length) events[events.length - 1].end = Date.now();
  motion = next;
  if (motion) {
    lastMotion = Date.now();
    motionSinceSample = true;
  }
  if (Date.now() - lastHist >= 5000) {
    lastHist = Date.now();
    for (const [k, v] of [['rain', Math.round(rain)], ['tds', scenario === 'invalid' ? null : Math.round(tds)], ['gas', Math.round(gas)], ['motion', motion || motionSinceSample ? 1 : 0]]) {
      hist[k].push(v);
      if (hist[k].length > 720) hist[k].shift();
    }
    motionSinceSample = false;
  }
}, 500);

const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.searchParams.get('scenario')) scenario = url.searchParams.get('scenario');
    if (url.pathname === '/api/sensors') {
      const invalid = scenario === 'invalid';
      return send(res, 200, {
        device: 'Mock-ESP32',
        fw: '1.1.0-mock',
        board: 'ESP32-D0WD-V3',
        uptime: Math.round((Date.now() - start) / 1000) + 3 * 86400 + 4 * 3600,
        rssi: -58,
        ip: null,
        rain: { raw: Math.round(4095 - (rain / 100) * 4095), percent: +rain.toFixed(1), raining: rain > 60, ok: true },
        tds: { raw: invalid ? 4095 : Math.round(tds * 3), voltage: invalid ? 3.3 : +(tds / 400).toFixed(3), ppm: invalid ? 0 : +tds.toFixed(1), temp: 22.4, ok: !invalid },
        gas: { raw: Math.round((gas / 100) * 4095), percent: +gas.toFixed(1), alarm: gas > 75, ok: true },
        motion: { detected: motion, count, lastSeconds: lastMotion ? Math.round((Date.now() - lastMotion) / 1000) : -1 },
      });
    }
    if (url.pathname === '/api/history') {
      const now = Date.now();
      return send(res, 200, {
        step: 5,
        age: Math.round((now - lastHist) / 1000),
        ...hist,
        events: events
          .slice(-50)
          .reverse()
          .map((e) => [Math.round((now - e.start) / 1000), e.end ? Math.round((e.end - e.start) / 1000) : -1]),
      });
    }
    send(res, 404, { error: 'not found' });
  })
  .listen(PORT, () => {
    const ips = Object.values(os.networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => i.address);
    console.log(`Mock ESP32 (${scenario}) running. In the app use one of: ${ips.join(', ')}  port ${PORT}`);
    console.log('Switch scenario live: http://localhost:' + PORT + '/api/sensors?scenario=danger|normal|invalid');
  });
