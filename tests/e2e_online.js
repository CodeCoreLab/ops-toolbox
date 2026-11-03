// 线上 E2E 回归：返回工具站链接 + GitHub 按钮 + 离线包自包含
// 用法：node tests/e2e_online.js   （需先 npm i playwright 或全局安装后设 NODE_PATH）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const BASE = process.env.SITE_BASE || 'https://xmtooldev.gf.com.cn';
const REPO = path.resolve(__dirname, '..');
const TMP = path.join(os.tmpdir(), 'ops-toolbox-online-e2e');
let pass = 0, fail = 0;
const errors = [];

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch({ args: ['--ignore-certificate-errors'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  // ============ 1. ops-toolbox 落地页 ============
  console.log('\n=== ops-toolbox 落地页 ===');
  await page.goto(BASE + '/ops-toolbox/', { waitUntil: 'networkidle' });
  ok('页面标题正确', (await page.title()).includes('运维'), await page.title());

  const back = await page.locator('a.nav-back').count();
  ok('存在 .nav-back 返回按钮', back === 1, 'count=' + back);
  if (back) {
    const href = await page.locator('a.nav-back').getAttribute('href');
    ok('返回按钮指向工具站首页', href === 'https://xmtooldev.gf.com.cn/', href);
    const vis = await page.locator('a.nav-back').isVisible();
    ok('桌面端返回按钮可见', vis);
  }

  const gh = page.locator('a.nav-gh');
  ok('存在 .nav-gh GitHub 按钮', await gh.count() === 1);
  if (await gh.count()) {
    const href = await gh.getAttribute('href');
    ok('GitHub 按钮指向 CodeCoreLab/ops-toolbox', href === 'https://github.com/CodeCoreLab/ops-toolbox', href);
    ok('GitHub 按钮 target=_blank', await gh.getAttribute('target') === '_blank');
    ok('GitHub 按钮带 rel=noopener', (await gh.getAttribute('rel') || '').includes('noopener'));
    ok('GitHub 按钮可见', await gh.isVisible());
  }

  const dl = await page.locator('a.nav-dl').count();
  ok('存在 .nav-dl 下载离线版', dl === 1);
  if (dl) {
    const href = await page.locator('a.nav-dl').getAttribute('href');
    ok('下载按钮指向离线 zip', href === 'ops-toolbox-offline.zip', href);
  }

  const cta = await page.locator('a.nav-cta').getAttribute('href');
  ok('CTA 指向 tool.html', cta === 'tool.html', cta);

  // ============ 2. ops-toolbox 工具箱 ============
  console.log('\n=== ops-toolbox 工具箱 (tool.html) ===');
  await page.goto(BASE + '/ops-toolbox/tool.html', { waitUntil: 'networkidle' });
  const links = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
  ok('存在返回工具站链接', links.some(h => h === 'https://xmtooldev.gf.com.cn/'));
  ok('存在 GitHub 源码链接', links.some(h => h === 'https://github.com/CodeCoreLab/ops-toolbox'));
  ok('存在产品介绍页链接', links.some(h => h === 'https://xmtooldev.gf.com.cn/ops-toolbox/'));

  const topbar = await page.locator('.topbar a').count();
  ok('顶部操作条有 3 个入口', topbar === 3, 'count=' + topbar);

  // 侧边栏底部
  const sideLinks = await page.locator('.sidebar-footer a').count();
  ok('侧边栏底部有 3 个入口', sideLinks === 3, 'count=' + sideLinks);

  // 工具功能回归（此前修过的两个 BUG）
  await page.fill('#cidr-input', '192.168.1.0/24');
  await page.waitForTimeout(300);
  const cidr = await page.locator('#cidr-result').textContent().catch(() => '');
  ok('CIDR 掩码仍正确 (255.255.255.0)', cidr.includes('255.255.255.0'), (cidr || '').slice(0, 80));

  // ============ 3. 工具箱移动端 ============
  console.log('\n=== 移动端 ===');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/ops-toolbox/', { waitUntil: 'networkidle' });
  const backMobile = await page.locator('a.nav-back').count();
  ok('移动端仍有返回按钮元素', backMobile >= 1);
  if (backMobile) {
    const vis = await page.locator('a.nav-back').first().isVisible();
    ok('移动端返回按钮可见', vis);
  }
  const ghMobile = await page.locator('a.nav-gh').first().isVisible().catch(() => false);
  ok('移动端 GitHub 按钮可见', ghMobile);

  // ============ 4. 各工具 GitHub 按钮与返回链接 ============
  console.log('\n=== 全站工具链接审计 ===');
  const tools = [
    ['alert-sift', 'https://github.com/CodeCoreLab/alert-sift'],
    ['calendar-memo', 'https://github.com/CodeCoreLab/calendar-memo'],
    ['code-audit', 'https://github.com/CodeCoreLab/codeaudit-lite'],
    ['credvault', 'https://github.com/CodeCoreLab/credvault'],
    ['growth-tasks', 'https://github.com/CodeCoreLab/workbuddy-growth-tasks'],
    ['llm-router', 'https://github.com/CodeCoreLab/llm-router'],
    ['pmvault', 'https://github.com/CodeCoreLab/pmvault'],
    ['prompt-forge', 'https://github.com/CodeCoreLab/prompt-forge'],
    ['team-planner', 'https://github.com/CodeCoreLab/team-planner'],
    ['token-console', 'https://github.com/CodeCoreLab/token-console'],
    ['tokenwatcher', 'https://github.com/CodeCoreLab/tokenwatcher'],
    ['trae-wb-kit', 'https://github.com/CodeCoreLab/trae-wb-kit'],
    ['work-reminder', 'https://github.com/CodeCoreLab/work-reminder'],
    ['xmdesktop', 'https://github.com/CodeCoreLab/xmtool'],
    ['ops-toolbox', 'https://github.com/CodeCoreLab/ops-toolbox'],
  ];
  for (const [slug, ghUrl] of tools) {
    const resp = await page.goto(BASE + '/' + slug + '/', { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    const okStatus = resp && resp.status() === 200;
    const hasGh = html.includes(ghUrl);
    const hasBack = html.includes('https://xmtooldev.gf.com.cn/"');
    const hasDead = html.includes('maxin-cn/prompt-forge');
    ok(slug + ' 200 + GitHub 按钮 + 返回链接', okStatus && hasGh && hasBack && !hasDead,
      'status=' + (resp && resp.status()) + ' gh=' + hasGh + ' back=' + hasBack + ' dead=' + hasDead);
  }

  // reevelite：闭源产品，不应有 GitHub 按钮
  await page.goto(BASE + '/reevelite/', { waitUntil: 'domcontentloaded' });
  const rl = await page.content();
  ok('reevelite 无 GitHub 按钮（闭源产品）', !rl.includes('github.com'));

  // ============ 5. 离线包自包含 ============
  console.log('\n=== 离线包 ===');
  // zip 会触发下载而非导航，用 request API 取
  const api = await ctx.request.get(BASE + '/ops-toolbox/ops-toolbox-offline.zip');
  ok('离线包可下载', api.status() === 200, 'status=' + api.status());
  const buf = await api.body();
  fs.mkdirSync(TMP, { recursive: true });
  const tmp = path.join(TMP, 'dl.zip');
  fs.writeFileSync(tmp, buf);
  ok('离线包大小合理', buf.length > 20000 && buf.length < 100000, buf.length + 'B');

  // 解压验证包内 index.html 无 zip 自指死链（用 python 脚本文件避免引号转义）
  const pyFile = path.join(TMP, 'check_zip.py');
  fs.writeFileSync(pyFile, [
    "import zipfile",
    "z=zipfile.ZipFile(r'" + tmp.replace(/\\/g, '/') + "')",
    "names=z.namelist()",
    "print('NAMES',','.join(sorted(names)))",
    "print('BAD', len([n for n in names if n.startswith('.git/')]))",
    "h=z.read('index.html').decode('utf-8')",
    "print('SELFREF', 'ops-toolbox-offline.zip' in h)",
    "print('TOOL', 'tool.html' in h)",
  ].join('\n'));
  const pyOut = execFileSync(process.env.PYTHON || 'python', [pyFile], { encoding: 'utf-8' });
  console.log('   ' + pyOut.trim().split('\n').join('\n   '));
  ok('包内无 .git 残留', /\nBAD 0/.test(pyOut) || pyOut.includes('BAD 0'));
  ok('包内 index.html 无 zip 自指死链', pyOut.includes('SELFREF False'));
  ok('包内 index.html 含 tool.html 入口', pyOut.includes('TOOL True'));

  // ============ 6. 控制台错误 ============
  console.log('\n=== 控制台 ===');
  ok('无 JS 控制台错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
  console.log('\n============================');
  console.log('  PASS: ' + pass + '   FAIL: ' + fail);
  console.log('============================');
  if (fail) { errors.push('有 ' + fail + ' 项未通过'); process.exit(1); }
})().catch(e => { console.error('E2E 异常:', e); process.exit(2); });
