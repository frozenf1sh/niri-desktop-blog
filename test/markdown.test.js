import assert from "node:assert/strict";
import test from "node:test";
import { compilePost } from "../blog/markdown.js";
import { articleMarkup } from "../blog/markup.js";

const front = `---\ntitle: 测试\ndate: 2026-11-13\ndescription: 测试文章\ntags: [测试]\n---\n`;

test("compiles Markdown, highlighting, containers and trusted HTML", () => {
  const post = compilePost("sample", front + `\n## 章节\n\n> 引用\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n![图](./pic.png)\n\n::: warning 注意事项\n**内容**\n:::\n\n<div class="custom">自定义</div>\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n\n\`\`\`unknown-lang\nraw <code>\n\`\`\`\n`);
  assert.match(post.html, /<blockquote>/);
  assert.match(post.html, /class="post-table-wrap"/);
  assert.match(post.html, /__POST_SITE_ROOT__post-assets\/sample\/pic.png/);
  assert.match(post.html, /post-callout-warning/);
  assert.match(post.html, /<div class="custom">自定义<\/div>/);
  assert.match(post.html, /class="shiki/);
  assert.match(post.html, /class="post-code-copy" hidden/);
  assert.match(post.html, /raw &#x3C;code>/);
  assert.deepEqual(post.headings.map(({ label }) => label), ["章节"]);
  assert.match(articleMarkup(post, "reader1", "../../"), /src="\.\.\/\.\.\/post-assets\/sample\/pic.png"/);
  assert.match(articleMarkup(post, "reader1", "/blog/"), /id="reader1-post-sample-1"/);
});

test("local images cannot escape the article asset directory", () => {
  assert.throws(() => compilePost("sample", front + "\n![x](../secret.png)"), /图片路径/);
});
