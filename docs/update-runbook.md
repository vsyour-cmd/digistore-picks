# DigistorePicks 每日更新手册

目标:重新抓取 Digistore24 marketplace 数据 → 研究销售页 → 重建站点 → 推送上线。任何 ZCode 会话按本手册执行。

## 前置条件

- Digistore24 已在内置浏览器(IAB)登录。检测方式:在 digistore24.com 域名下执行
  `fetch('/v2/api/marketplace/results?query=&page=1&itemsPerPage=1&sort=stars&language%5B%5D=en&currency=&vendor=', {credentials:'include'})`
  返回 200 且 JSON 含 `result.count` → 会话有效。返回 302/登录页 → **停下,请用户重新登录**。

## 阶段 1:marketplace 抓取(需 IAB 登录态,在 IAB 标签页内 playwright.evaluate 分批执行)

所有请求带 `credentials:'include'`,基址 `https://www.digistore24-app.com`。

1. **产品列表**(约13页):`/v2/api/marketplace/results?query=&page={p}&itemsPerPage=100&sort=stars&language%5B%5D=en&currency=&vendor=`
   取 `result.items` + `result.count` + `sectionList`(仅第1页)。每次 evaluate 抓2页(30秒/次上限)。
2. **分类映射**(45个分类):同接口加 `&marketplaceCategoryId%5B%5D={catId}`,逐分类记录 `items[].id`。
3. 输出 `G:/Digistore24/data/products-en.json` 与 `categories-en.json`(结构见"数据文件结构")。

## 阶段 1b:推广链接变更通知(必做)

```
GET /v2/api/v1/notifications (IAB 内,credentials include)
```
用正则 `/products+(d+)s+froms+(.+?)s+has changed to:s*(.*?)s*(?:.s*From now on|From now on)/i` 提取变更,合并进 `G:/Digistore24/data/promo-updates.json`(按 productId 键,最高优先级),再对每条 confirm_all ajaxUrl 发 fetch 标记已读(基址 https://www.digistore24-app.com)。**不做这步,厂商改链接后我们的推广追踪会静默失效。**

## 阶段 2:销售页研究(Node 本地,无需浏览器)

```
cd G:/Digistore24/site
node build/fetch-research.js        # 默认只补失败/缺失项;--refresh 全量重抓
```
- Node fetch 无 CORS;并发8、15s超时、自动重试;输出 `G:/Digistore24/data/research-en.json`
- thin 质量的(JS渲染页)与失败页:对有档案页的重点产品用 IAB 渲染补齐(goto + 等4-5s + DOM 提取,参考 skill 的 1b 步)
- **域名死亡/SSL证书过期不是失败,是情报** —— 标注进研究档案

## 阶段 3:图片本地化(Node)

```
node build/fetch-images.js          # marketplace 官方图优先,og:image 兜底;已下载的自动跳过
node build/optimize-images.js       # 压缩转WebP(600px,q80)+记录尺寸;幂等,每日新增图自动处理
```
输出 `site/assets/products/{id}.{ext}` + `{id}.img.json` manifest。

## 阶段 4:构建

```
node build/build-dataset.js         # 合并 marketplace + research → site/data/dataset.json
node build/gen-md.js                # 每产品 MD 档案 → site/content/products/ (1243个)
node build/build-site.js            # 全产品 HTML 档案页 + 分类页 + 首页 + about(SEO/GEO: canonical/OG/JSON-LD/TL;DR/面包屑)
node build/build-blog.js            # 数据驱动博客(Article JSON-LD + Key takeaways)
node build/build-extras.js          # sitemap.xml / robots.txt / llms.txt / feed.xml(必须在最后)
# 新增页面生成器:build-site.js 同时产出 alternatives/(对比页60)+ best-of/(聚合页36)+ 404.html + 分类分页
```

数据文件结构(dataset.json):`{affiliateId:'adminstore', scrapedAt, researchedAt, total, withResearch, categories:[{catId,section,label,count}], products:[{id,productId,label,type,price,currency,commission,conversionRate,cancelRate,earningsPerSale,earningsPerClick,vendorName,description,imageUrl,salesPageUrl,promoLink,affiliateSupportPageUrl,autoAccept,billingTypes,createdAt,categories,categoryIds,research?}]}`

推广链接规律(三档):
1. **Digistore24 自家域名**(digistore24.com/product、checkout-ds24.com/product):`销售页 + ('?'或'&') + 'aff=adminstore'`(查询参数,官方追踪格式,如 `?voucher=X&aff=adminstore`)
2. **vendor 域名**:`销售页 + ('?'或'&') + 'aff=adminstore' + '#aff=adminstore'`(查询+锚点双保险:DS24 嵌入 JS 读锚点,funnel 工具读查询参数)
3. **坏URL**(含 `#`、`[占位符]`、无销售页):规范重定向 `https://www.digistore24.com/redir/{productId}/adminstore`

## 阶段 5:发布

```
cd G:/Digistore24/site
git add -A
git -c user.name="vsyour-cmd" -c user.email="vsyour-cmd@users.noreply.github.com" commit -m "Daily update YYYY-MM-DD: ..."
git push origin main
```
GitHub Pages 约1分钟生效。验证 https://vsyour-cmd.github.io/digistore-picks/

## 阶段 6:IndexNow 实时推送(Bing/ChatGPT 搜索源)

```
# 等 Pages 构建完成后再执行(约60-90秒):
node build/ping-indexnow.js
```
- 默认提交最近一次 commit 变动的 .html + 首页/博客/产品索引(上限100条)
- `--all` 提交全部分类页+博客(~62条,仅全量重建后用)
- key 文件 `{32位hex}.txt` 在站点根目录(必须永久保留);GitHub Pages 项目站无法放域名根,脚本用 keyLocation 参数声明位置,勿删该参数

## 手写文章(不覆盖机制)

- 手写评测放 `site/reviews/{slug}.html` + 登记 `site/build/articles.json`(`[{productId}]`)→ 构建跳过
- 编辑文章放 `site/blog/`(build-blog.js 只写固定文件名清单,不会覆盖手写文件)

## 内容红线(来自 digistore24-trust-landing skill)

- 数字只用 marketplace 官方数据,页面标注数据来源与刷新日期
- 销售页素材必须标 "vendor claims, not verified by us",逐字引用
- 不伪造使用体验;手写页必须标注研究方式(data profile / hands-on)
- FTC affiliate 披露每页必有(模板已内置)
- 退款天数以官方销售页实时为准,不缓存具体天数

## 德语站(site-de)

数据目录 `G:/Digistore24/data-de/`(products-de.json / categories-de.json / research-de.json);推广链接 overrides 共用英文站的 promo-updates.json(按 productId,与语言无关)。

```
cd G:/Digistore24/site-de
node build/build-dataset-de.js    # 合并(分类名经 LABEL_DE 映射转德语)
node build/fetch-research.js      # 默认即指向 data-de,无需环境变量
node build/fetch-images.js        # DE 已下 Top2000,日常增量
node build/optimize-images.js
node build/gen-md.js              # MD 链接指向 /produkte/
node build/build-site.js          # 德语UI+Impressum/Datenschutz;路径 /kategorie/ /produkte/ /alternativen/ /empfehlungen/
node build/build-blog.js          # 德语博客(Top20+checklist+10分类指南)
node build/build-extras.js        # sitemap(4595 URL)/llms.txt/feed
node build/ping-indexnow.js       # 德语目录名版(kategorie/empfehlungen/alternativen)
```

德语站注意事项:
- Impressum/Datenschutz 真实身份在 build-site.js 的 staticPages();身份变更在这里改
- 分类文件名用英文 label slug(如 kategorie/health-fitness.html),显示名德语
- 研究覆盖率约86%,余为死链德语域名(如实标注,勿强行补)
- 仓库: vsyour-cmd/digistore-picks-de;GSC/Bing 提交: https://vsyour-cmd.github.io/digistore-picks-de/sitemap.xml
- 双站互链与 hreflang 已内置(页脚语言切换),构建时自动生成


## 每日改进轮换与总结(自动任务第6/8步)

- 改进清单: G:/Digistore24/improvements-backlog.json(每项 {id, site: both/en/de, title, done, doneDate})。每日取第一个未完成且匹配的项执行,完成标记 done+doneDate;失败的标记 done+note 并顺延下一项。
- 每日总结: 两站 build/changelog.json 顶部插入今日条目 {date, summary, changes[]},保留≤60条;build-site 渲染为公开页 /changelog.html(What's new / Neuigkeiten),页脚有入口,sitemap 收录。
- QA 门禁(qa-links.js): 死链=0、模板泄漏=0、标题>70=0、DE无correction残留。不过不提交。
