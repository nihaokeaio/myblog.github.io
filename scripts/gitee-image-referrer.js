'use strict';

const giteeImageSource = /\bsrc\s*=\s*(["'])https:\/\/(?:gitee\.com|raw\.giteeusercontent\.com)\/[^"']+\1/i;
const hasReferrerPolicy = /\breferrerpolicy\s*=/i;

hexo.extend.filter.register('after_post_render', data => {
  if (typeof data.content !== 'string') return data;

  data.content = data.content.replace(/<img\b[^>]*>/gi, imageTag => {
    if (!giteeImageSource.test(imageTag) || hasReferrerPolicy.test(imageTag)) {
      return imageTag;
    }

    return imageTag.replace(/^<img\b/i, '<img referrerpolicy="no-referrer"');
  });

  return data;
});
