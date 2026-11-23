// Ready-made groups offered during setup. Users can edit everything afterwards.
// Because the most specific pattern wins, e.g. "mail.google.com" (Mail) beats
// "*.google.com" if a user adds that to another group.

export const PRESETS = [
  {
    key: 'mail', title: 'Mail', color: 'blue',
    patterns: ['mail.google.com', 'calendar.google.com', 'outlook.live.com', 'outlook.office.com',
      'outlook.office365.com', 'outlook.cloud.microsoft', 'mail.proton.me', '*.fastmail.com', 'mail.yahoo.com'],
  },
  {
    key: 'docs', title: 'Docs', color: 'yellow',
    patterns: ['docs.google.com', 'drive.google.com', '*.notion.so', '*.notion.site', '*.office.com',
      '*.sharepoint.com', '*.dropbox.com', '*.figma.com', '*.miro.com', '*.canva.com'],
  },
  {
    key: 'video', title: 'Video', color: 'red',
    patterns: ['*.youtube.com', 'youtu.be', '*.netflix.com', '*.twitch.tv', '*.vimeo.com',
      '*.disneyplus.com', '*.primevideo.com', '*.max.com', '*.crunchyroll.com'],
  },
  {
    key: 'social', title: 'Social', color: 'pink',
    patterns: ['*.x.com', '*.twitter.com', '*.instagram.com', '*.facebook.com', '*.reddit.com',
      '*.linkedin.com', '*.tiktok.com', '*.threads.net', '*.bsky.app', '*.mastodon.social', '*.pinterest.com'],
  },
  {
    key: 'shopping', title: 'Shopping', color: 'green',
    patterns: ['*.amazon.*', '*.ebay.*', '*.etsy.com', '*.aliexpress.com', '*.temu.com', '*.zalando.*', '*.ikea.com'],
  },
  {
    key: 'ai', title: 'AI', color: 'cyan',
    patterns: ['*.chatgpt.com', '*.openai.com', '*.claude.ai', 'gemini.google.com', '*.perplexity.ai',
      '*.grok.com', 'copilot.microsoft.com', '*.deepl.com', '*.mistral.ai'],
  },
  {
    key: 'dev', title: 'Dev', color: 'purple',
    patterns: ['*.github.com', '*.gitlab.com', '*.stackoverflow.com', '*.stackexchange.com',
      'developer.mozilla.org', '*.npmjs.com', '*.pypi.org', '*.vercel.com', '*.netlify.com', 'localhost', '127.0.0.1'],
  },
  {
    key: 'news', title: 'News', color: 'orange',
    patterns: ['news.google.com', '*.bbc.com', '*.bbc.co.uk', '*.cnn.com', '*.nytimes.com', '*.theguardian.com',
      '*.reuters.com', '*.apnews.com', '*.spiegel.de', '*.derstandard.at'],
  },
  {
    key: 'files', title: 'Files', color: 'grey',
    patterns: ['file://*'],
  },
];

export const CATCH_ALL_TITLE = 'Other';
