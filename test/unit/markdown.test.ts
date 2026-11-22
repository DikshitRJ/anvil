import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../webview/markdown';

describe('renderMarkdown', () => {
  it('escapes raw html payloads', () => {
    for (const p of ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '<a href="x">y</a>']) {
      const out = renderMarkdown(p);
      expect(out).not.toMatch(/<(img|script|a)[\s>]/i);
      expect(out).toContain('&lt;');
    }
  });

  it('never emits anchors for links, including javascript: urls', () => {
    const out = renderMarkdown('[x](javascript:alert(1)) and [ok](https://e.com)');
    expect(out).not.toContain('<a');
    expect(out).toContain('x (javascript:alert(1))');
    expect(out).toContain('ok (https://e.com)');
  });

  it('keeps html inside code fences escaped', () => {
    const out = renderMarkdown('```html\n<script>x</script>\n```');
    expect(out).toBe('<pre><code class="lang-html">&lt;script&gt;x&lt;/script&gt;</code></pre>');
  });

  it('handles an unterminated fence while streaming', () => {
    const out = renderMarkdown('text\n```py\nprint("<b>")');
    expect(out).toContain('<pre><code class="lang-py">print(&quot;&lt;b&gt;&quot;)</code></pre>');
    expect(out).not.toContain('<b>');
  });

  it('renders inline formatting', () => {
    expect(renderMarkdown('a **b** *c* _d_ `e<f`')).toBe(
      '<p>a <strong>b</strong> <em>c</em> <em>d</em> <code>e&lt;f</code></p>',
    );
  });

  it('does not format inside inline code', () => {
    expect(renderMarkdown('`**x**`')).toBe('<p><code>**x**</code></p>');
  });

  it('renders headings, lists and blockquotes', () => {
    expect(renderMarkdown('# A\n## B\n### C')).toBe('<h4>A</h4><h5>B</h5><h6>C</h6>');
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>');
    expect(renderMarkdown('1. a\n2) b')).toBe('<ol><li>a</li><li>b</li></ol>');
    expect(renderMarkdown('> quote <i>')).toBe('<blockquote>quote &lt;i&gt;</blockquote>');
  });

  it('joins lines with br and splits paragraphs', () => {
    expect(renderMarkdown('a\nb\n\nc')).toBe('<p>a<br>b</p><p>c</p>');
  });

  it('strips placeholder chars from input', () => {
    expect(renderMarkdown('`a` \uE0000\uE000')).toBe('<p><code>a</code> 0</p>');
  });
});

describe('extended code fences', () => {
  it('renders tilde-fenced code and escapes its body', () => {
    expect(renderMarkdown('~~~html\n<div>safe</div>\n~~~')).toBe(
      '<pre><code class="lang-html">&lt;div&gt;safe&lt;/div&gt;</code></pre>',
    );
  });
  it('keeps shorter or mismatched fences literal inside longer fences', () => {
    expect(renderMarkdown('````md\n```\n~~~\n````')).toBe('<pre><code class="lang-md">```\n~~~</code></pre>');
  });
  it('handles indented and unterminated fences during streaming', () => {
    expect(renderMarkdown('  ~~~~ts\nconst value = 1;')).toBe(
      '<pre><code class="lang-ts">const value = 1;</code></pre>',
    );
    expect(renderMarkdown('~~~\nbody\n~~~~\nafter')).toBe('<pre><code>body</code></pre><p>after</p>');
  });
});
