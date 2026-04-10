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
      const { word, meaning, pos, hanja } = body;

      if (!word) {
        return new Response(JSON.stringify({ error: 'Missing word' }), {
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

      // 3. Prompt 설계 (Anki 스타일: 채점 생략, 3개의 예문 및 상세 해설 생성)
      const promptText = `
너는 고등학생의 수능 국어/고급 어휘 학습을 도와주는 최고의 국어 선생님이야.
학생이 학습할 단어 정보는 다음과 같아:
단어: "${word}"
품사: "${pos || '알 수 없음'}"
기본 뜻: "${meaning || '알 수 없음'}"
한자: "${hanja || '고유어 혹은 알 수 없음'}"

이 정보를 바탕으로 학생이 단어를 완벽히 이해할 수 있도록 다음 3가지 정보를 반드시 JSON 형식으로만 반환해줘. 다른 말은 절대 추가하지 마.

1. "examples": 이 단어가 아주 자연스럽게 사용된 실생활/수능 수준의 예문 3개. (각 예문 안에서 해당 단어 부분은 반드시 HTML <strong> 태그로 감싸야 해!)
2. "detailedMeaning": 이 단어의 숨겨진 뉘앙스나 언제 주로 쓰이는지 부드럽고 친절하게 설명해줘.
3. "hanjaBreakdown": 단어가 한자어라면 각 한자의 뜻과 음을 쪼개서 설명하고, 왜 그런 뜻이 되었는지 어원을 설명해줘. 순우리말(고유어)이라면 어원이나 외우기 쉬운 연상법(Mnemonic)을 알려줘.

JSON 응답 예시:
{
  "examples": [
    "그는 파죽지세로 밀고 나갔다.",
    "적들은 <strong>파죽지세</strong>에 겁을 먹었다.",
    "우리의 <strong>파죽지세</strong> 같은 기세"
  ],
  "detailedMeaning": "정확한 뉘앙스와 쓰임새 설명",
  "hanjaBreakdown": "한자 분해 또는 연상법"
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
