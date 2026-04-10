/**
 * Cloudflare Worker for Korean Words App using Google Gemini API
 * 이 파일은 프론트엔드에 포함되지 않고 Cloudflare 플랫폼에 배포되어야 합니다.
 */

export default {
  async fetch(request, env, ctx) {
    // 1. CORS 처리
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // GET 요청 시 (사용자가 브라우저로 사이트에 접속했을 때)
    if (request.method === 'GET') {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request); // index.html 등 정적 웹사이트 파일 제공
      }
      return new Response("API is running", { status: 200, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Only POST method is allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const { word, meaning, hanja, pos } = body;

      if (!word) {
        return new Response(JSON.stringify({ error: 'Missing word in request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API Key not configured on server' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Anki 스타일 1회 호출용 프롬프트
      const promptText = `
당신은 최고 수준의 국어 교육 AI입니다. 다음 단어 정보를 바탕으로 학습자가 단어의 뜻을 유추하고 깊이 있게 이해할 수 있는 학습 자료를 생성하세요.

단어: "${word}"
품사: "${pos || '알수없음'}"
사전적 의미: "${meaning || '의미 파악 불가'}"
한자 정보: "${hanja || ''}"

규칙:
1. "examples": 학습자가 뜻을 유추할 수 있도록 돕는 실용적이고 자연스러운 예문 3개를 배열로 제공하세요. 예문 내 "${word}"(및 활용형)은 <strong> 태그로 강조하세요.
2. "nuance": 해당 단어의 속뜻, 뉘앙스, 혹은 비슷한 단어와의 차이점을 1~2문장으로 친절하게 설명하세요.
3. "hanjaBreakdown": 단어가 한자어일 경우 각 한자의 음과 뜻을 분리(예: 破 깨뜨릴 파)하여 설명하고, 이 한자들이 모여 왜 현재의 뜻이 되었는지 어원을 서술하세요. 고유어라면 빈 문자열을 반환하세요.

응답은 반드시 아래 JSON 형식으로만 출력하세요 (텍스트 설명 제외):
{
  "examples": ["첫 번째 예문", "두 번째 예문", "세 번째 예문"],
  "nuance": "뉘앙스 설명",
  "hanjaBreakdown": "한자 뜻풀이"
}
`.trim();

      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      
      const geminiResponse = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      if (!geminiResponse.ok) {
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
      }

      const data = await geminiResponse.json();
      const textOutput = data.candidates[0].content.parts[0].text;
      const cleanJsonStr = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      const resultObj = JSON.parse(cleanJsonStr);

      return new Response(JSON.stringify(resultObj), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
