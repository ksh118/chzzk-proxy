const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());

// 상태를 확인할 채널 ID (환경변수로도 덮어쓸 수 있게 해둠)
const CHANNEL_ID = process.env.CHZZK_CHANNEL_ID || '73e605f0102e08c78d30e62414ad2542';

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

// 치지직 채팅 접속 정보 (chatChannelId + 접속 토큰) — 브라우저는 CORS 때문에 직접 못 받아요
app.get('/api/chat-info', async (req, res) => {
  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  try {
    const channelId = String(req.query.channelId || CHANNEL_ID);
    if (!/^[0-9a-f]{32}$/i.test(channelId)) {
      return res.status(400).json({ message: '채널 ID 형식이 올바르지 않아요 (32자리).' });
    }
    const headers = { 'User-Agent': UA };

    const detail = await axios.get(
      `https://api.chzzk.naver.com/service/v2/channels/${channelId}/live-detail`,
      { headers, timeout: 8000 }
    );
    const c = detail.data && detail.data.content;
    const chatChannelId = c && c.chatChannelId;
    if (!chatChannelId) {
      return res
        .status(404)
        .json({ message: '채팅 채널을 찾지 못했어요. 방송 중인지 확인해 주세요.' });
    }

    const tk = await axios.get('https://comm-api.game.naver.com/nng_main/v1/chats/access-token', {
      params: { channelId: chatChannelId, chatType: 'STREAMING' },
      headers,
      timeout: 8000,
    });
    const tc = tk.data && tk.data.content;
    if (!tc || !tc.accessToken) {
      return res.status(502).json({ message: '채팅 접속 토큰을 받지 못했어요.' });
    }

    res.set('Cache-Control', 'no-store');
    return res.json({
      chatChannelId,
      accessToken: tc.accessToken,
      extraToken: tc.extraToken || '',
      isLive: c.status === 'OPEN',
    });
  } catch (err) {
    console.error('CHZZK chat-info error:', err.message);
    return res.status(502).json({ message: '치지직 서버 응답 오류: ' + err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

module.exports = app;
