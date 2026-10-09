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
```
输出 `site/assets/products/{id}.{ext}` + `{id}.img.json` manifest。

## 阶段 4:构建

```
node build/build-dataset.js         # 合并 marketplace + research → site/data/dataset.json
node build/gen-md.js                # 每产品 MD 档案 → site/content/products/ (1243个)
node build/build-site.js            # 全产品 HTML 档案页 + 分类页 + 首页 + about(SEO/GEO: canonical/OG/JSON-LD/TL;DR/面包屑)
node build/build-blog.js            # 数据驱动博客(Article JSON-LD + Key takeaways)
node build/build-extras.js          # sitemap.xml / robots.txt / llms.txt / feed.xml(必须在最后)
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
