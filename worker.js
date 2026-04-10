/**
 * Cloudflare Worker for Korean Words App using Google Gemini API
 * 이 파일은 프론트엔드에 포함되지 않고 Cloudflare 플랫폼에 배포되어야 합니다.
 */

export default {
  async fetch(request, env, ctx) {
    // 1. CORS 처리: 브라우저에서 직접 호출할 수 있도록 허용
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Only POST method is allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const { word, userAnswer } = body;

      if (!word || !userAnswer) {
        return new Response(JSON.stringify({ error: 'Missing word or userAnswer' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. 환경 변수에서 Gemini API 키 가져오기 (Cloudflare Dashboard에서 설정해야 함)
      // `wrangler.toml` 이나 대시보드의 Secret Variables에 `GEMINI_API_KEY`를 넣으세요.
      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API Key not configured on server' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Prompt 설계
      const promptText = `
너는 국어 단어 학습을 도와주는 친절한 선생님이야. 
문제로 나온 단어는 "${word}" 이며, 학생이 작성한 이 단어의 뜻은 "${userAnswer}" 야.

다음 5가지 정보를 반드시 JSON 형식으로만 반환해줘. 다른 말은 절대 추가하지 마.
1. "isCorrect": 학생의 답이 완벽히 맞으면 "correct", 의미가 어느 정도 통하면 "partial", 아예 틀리거나 상관없으면 "incorrect" 로 작성.
2. "feedback": 학생의 답변을 친절하게 채점하며 뉘앙스 차이나 이유를 설명해 줄 것.
3. "exactMeaning": "${word}"의 표준국어대사전 기준 정확하고 명료한 뜻.
4. "exampleSentence": "${word}" 단어를 활용한 실생활 예문. 단어가 눈에 띄게 HTML <strong> 태그로 감싸져 있어야 함.
5. "hanjaBreakdown": 만약 "${word}"가 한자어라면, 각 한자의 음과 뜻을 풀이하고 왜 그런 의미가 되었는지 간략히 설명해줘. 고유어라면 빈 문자열("")를 반환해.

JSON 응답 예시:
{
  "isCorrect": "partial",
  "feedback": "의미를 비슷하게 파악하셨어요! 하지만 정확한 뉘앙스는 ~~입니다.",
  "exactMeaning": "정확한 뜻 내용",
  "exampleSentence": "그는 <strong>단어</strong> 이렇게 말했다.",
  "hanjaBreakdown": "單(홑 단) 語(말씀 어): 낱말을 뜻합니다."
}
      `.trim();

      // 4. Gemini API 호출 (gemini-3-flash-preview 모델 사용)
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
      
      // JSON 파싱 (Gemini가 마크다운 틱을 포함할 수 있으므로 제거)
      const cleanJsonStr = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      const resultObj = JSON.parse(cleanJsonStr);

      // 5. 프론트엔드로 전달
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
