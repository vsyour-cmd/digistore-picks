# DigistorePicks 每日更新手册

目标:重新抓取 Digistore24 marketplace 数据 → 重建站点 → 推送上线。任何 ZCode 会话按本手册执行。

## 前置条件

- Digistore24 已在内置浏览器(IAB)登录。检测方式:在 digistore24.com 域名下执行
  `fetch('/v2/api/marketplace/results?query=&page=1&itemsPerPage=1&sort=stars&language%5B%5D=en&currency=&vendor=', {credentials:'include'})`
  返回 200 且 JSON 含 `result.count` → 会话有效。返回 302/登录页 → **停下,请用户重新登录**。

## 抓取(在 IAB 标签页内用 playwright.evaluate 分批执行)

所有请求都带 `credentials:'include'`,基址 `https://www.digistore24-app.com`。

1. **产品列表**(约13页):`/v2/api/marketplace/results?query=&page={p}&itemsPerPage=100&sort=stars&language%5B%5D=en&currency=&vendor=`
   取 `result.items`(数组)+ `result.count` + `sectionList`(仅第1页有)。每次 evaluate 抓2页,超时上限约30秒/次。
2. **分类映射**(45个分类,`sectionList[].categoryList[].id`):
   `/v2/api/marketplace/results?...&marketplaceCategoryId%5B%5D={catId}` 逐分类抓全部页,记录 `items[].id`。
3. **推广链接**:规律已验证 —— `promoLink = salesPageUrl + '#aff=adminstore'`(affiliate ID: `adminstore`)。
   例外:URL 含 `#` 或 `[占位符]` 的产品用官方重定向 `https://www.digistore24.com/redir/{productId}/adminstore`。
   **无需再逐个抓接口**,除非 Digistore24 改版。

## 构建(本地,G:\Digistore24)

```
# 1. 更新 G:/Digistore24/data/dataset-en.json(结构见下)
# 2. 同步到站点并构建
cp G:/Digistore24/data/dataset-en.json G:/Digistore24/site/data/dataset.json
cd G:/Digistore24/site
node build/build-site.js --profiles 30
node build/build-blog.js
```

dataset-en.json 结构:`{affiliateId, scrapedAt, language:'en', total, categories:[{catId,section,label,count,slug?}], products:[{id,productId,label,type,price,currency,commission,conversionRate,cancelRate,earningsPerSale,earningsPerClick,vendorName,description,imageUrl,salesPageUrl,promoLink,affiliateSupportPageUrl,autoAccept,billingTypes,createdAt,categories,categoryIds}]}`
(slug 字段由构建脚本生成,数据文件里不需要)

分类 slug 冲突规则:同名分类(不同 section)slug 加 section 前缀,如 `digital-products-animals-pets`。

## 发布

```
cd G:/Digistore24/site
git add -A
git -c user.name="vsyour-cmd" -c user.email="vsyour-cmd@users.noreply.github.com" commit -m "Daily update YYYY-MM-DD"
git push origin main
```
GitHub Pages 自动部署,约1分钟生效。验证:https://vsyour-cmd.github.io/digistore-picks/

## 手写文章(不覆盖机制)

- 手写评测放 `site/reviews/{slug}.html`,并在 `site/build/articles.json`(`[{productId}]`)登记 → 构建脚本会跳过这些文件。
- 编辑文章放 `site/blog/`,由 `build-blog.js` 生成的文件顶部有 "Data refreshed" 日期,每次构建自动更新;纯手写文件不会被脚本覆盖(脚本只写固定文件名列表)。

## 内容红线(来自 digistore24-trust-landing skill)

- 数字只用 marketplace 官方数据,页面标注数据来源与刷新日期
- 不伪造使用体验;手写页必须标注研究方式(data profile / hands-on)
- FTC affiliate 披露每页必有(模板已内置)
- 退款天数等以官方销售页实时为准,不缓存具体天数
