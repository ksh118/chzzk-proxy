const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

// 상태를 확인할 채널 ID (환경변수로도 덮어쓸 수 있게 해둠)
const CHANNEL_ID = process.env.CHZZK_CHANNEL_ID || 'bb382c2c0cc9fa7c86ab3b037fb5799c';

// 치지직 라이브 상태 조회
app.get('/api/live-status', async (req, res) => {
  try {
    const channelId = req.query.channelId || CHANNEL_ID;

    const response = await axios.get(
      `https://api.chzzk.naver.com/service/v2/channels/${channelId}/live-detail`,
      {
        headers: {
          // 치지직이 일반 브라우저 요청처럼 보이도록 User-Agent를 지정
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        },
        timeout: 8000,
      }
    );

    const content = response.data && response.data.content;

    if (!content) {
      return res.json({ isLive: false });
    }

    const isLive = content.status === 'OPEN';

    return res.json({
      isLive,
      liveTitle: content.liveTitle || '',
      thumbnailUrl: (content.liveImageUrl || '').replace('{type}', '480'),
      viewerCount: content.concurrentUserCount || 0,
      channelName: content.channel ? content.channel.channelName : '',
      channelImageUrl: content.channel ? content.channel.channelImageUrl : '',
      liveUrl: `https://chzzk.naver.com/live/${channelId}`,
    });
  } catch (err) {
    console.error('CHZZK API error:', err.message);
    // 실패했을 때도 프론트가 죽지 않도록 isLive:false로 응답
    return res.json({ isLive: false, error: true });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

module.exports = app;
