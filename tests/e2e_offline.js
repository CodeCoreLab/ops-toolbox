// 离线包自包含 E2E：file:// 打开，验证渲染 + 链接可达性
// 用法：node tests/e2e_offline.js   （需先 npm i playwright 或全局安装后设 NODE_PATH）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

// 全部路径相对脚本位置推导，不依赖特定机器的绝对路径
const REPO = path.resolve(__dirname, '..');
const ZIP = process.env.OFFLINE_ZIP || path.join(REPO, 'ops-toolbox-offline.zip');
const EXTRACT = path.join(os.tmpdir(), 'ops-toolbox-offline-e2e');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

// 解压（用脚本文件而非 -c，避免引号转义在不同 shell 下失败）
function findPython() {
  for (const c of ['python', 'python3', 'py']) {
    try {
      execFileSync(c, ['--version'], { stdio: 'ignore' });
      return c;
    } catch (e) { /* 试下一个 */ }
  }
  throw new Error('未找到 python 解释器');
}
const PY = findPython();

fs.rmSync(EXTRACT, { recursive: true, force: true });
fs.mkdirSync(EXTRACT, { recursive: true });
const extractPy = path.join(os.tmpdir(), 'ops-toolbox-e2e-extract.py');
fs.writeFileSync(extractPy,
  'import zipfile\n' +
  'z = zipfile.ZipFile(r"' + ZIP.replace(/\\/g, '/') + '")\n' +
  'z.extractall(r"' + EXTRACT.replace(/\\/g, '/') + '")\n' +
  'print("extracted", len(z.namelist()))\n', 'utf-8');
execFileSync(PY, [extractPy], { encoding: 'utf-8' });

(async () => {
  const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  const idxUrl = 'file:///' + path.join(EXTRACT, 'index.html').replace(/\\/g, '/');
  const toolUrl = 'file:///' + path.join(EXTRACT, 'tool.html').replace(/\\/g, '/');

  // ============ 落地页 ============
  console.log('\n=== 离线落地页 (file://) ===');
  await page.goto(idxUrl, { waitUntil: 'load' });
  ok('标题渲染', (await page.title()).includes('运维'), await page.title());
  ok('body 有内容', (await page.locator('body').textContent()).length > 500);

  const hrefs = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
  const siteAbs = hrefs.filter(h => h && h.includes('xmtooldev.gf.com.cn'));
  ok('无站内绝对地址（离线不可达）', siteAbs.length === 0, siteAbs.join(','));
  const zipRef = hrefs.filter(h => h && h.includes('ops-toolbox-offline.zip'));
  ok('无 zip 自指死链', zipRef.length === 0, zipRef.join(','));
  ok('有 tool.html 本地入口', hrefs.includes('tool.html'));
  ok('已移除「下载离线版」按钮', !hrefs.some(h => h && h.includes('offline.zip')));
  ok('导航栏无 .nav-dl 残留', await page.locator('.nav-dl').count() === 0);
  ok('导航栏无 .nav-back 残留', await page.locator('.nav-back').count() === 0);
  ok('GitHub 图标按钮仍在', await page.locator('a.nav-gh').count() === 1);

  // 每个本地 href 目标文件必须真实存在
  const files = fs.readdirSync(EXTRACT);
  const localHrefs = [...new Set(hrefs.filter(h => h && !h.startsWith('#') && !h.startsWith('http') && !h.startsWith('data:')))];
  for (const h of localHrefs) {
    ok('本地链接目标存在: ' + h, files.includes(h), 'dir=' + files.join(','));
  }

  // 点击本地入口能真正跳转到 tool.html
  await page.click('a.nav-cta');
  await page.waitForTimeout(600);
  ok('CTA 点击跳转到 tool.html', page.url().endsWith('tool.html'), page.url());

  // ============ 工具箱 ============
  console.log('\n=== 离线工具箱 (file://) ===');
  await page.goto(toolUrl, { waitUntil: 'load' });
  const threfs = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
  const tsite = threfs.filter(h => h && h.includes('xmtooldev.gf.com.cn'));
  ok('工具箱无站内绝对地址', tsite.length === 0, tsite.join(','));
  ok('「产品介绍」指向包内 index.html', threfs.includes('index.html'));

  const topbar = await page.locator('.topbar a').count();
  ok('topbar 保留 2 个入口', topbar === 2, 'count=' + topbar);
  const side = await page.locator('.sidebar-footer a').count();
  ok('sidebar-footer 保留 2 个入口', side === 2, 'count=' + side);

  // 功能回归
  await page.fill('#cidr-input', '192.168.1.0/24');
  await page.waitForTimeout(300);
  const cidr = await page.locator('#cidr-result').textContent().catch(() => '');
  ok('CIDR 掩码正确 (255.255.255.0)', cidr.includes('255.255.255.0'), (cidr || '').slice(0, 60));

  await page.fill('#base64-input', '运维工具箱');
  await page.click('button:has-text("编码 → Base64")');
  await page.waitForTimeout(300);
  const b64 = await page.locator('#base64-result').textContent().catch(() => '');
  ok('Base64 编码可用', b64.trim().length > 0, (b64 || '').slice(0, 40));

  // 侧边栏 20 项
  const navItems = await page.locator('.nav-item').count();
  ok('侧边栏 20 个工具项', navItems === 20, 'count=' + navItems);

  // 移动端
  console.log('\n=== 移动端 ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(toolUrl, { waitUntil: 'load' });
  await page.click('.mobile-toggle');
  await page.waitForTimeout(400);
  ok('移动端汉堡可展开侧边栏', await page.locator('.sidebar.open').count() === 1);

  // 外部资源：离线包不应有任何 http(s) 资源加载（src/link/script）
  console.log('\n=== 外部资源 ===');
  const reqs = [];
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) reqs.push(r.url()); });
  await page.goto(idxUrl, { waitUntil: 'networkidle' });
  await page.goto(toolUrl, { waitUntil: 'networkidle' });
  ok('零外部资源请求', reqs.length === 0, reqs.slice(0, 3).join(' | '));

  ok('无 JS 控制台错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
  console.log('\n============================');
  console.log('  PASS: ' + pass + '   FAIL: ' + fail);
  console.log('============================');
  if (fail) process.exit(1);
})().catch(e => { console.error('E2E 异常:', e); process.exit(2); });
