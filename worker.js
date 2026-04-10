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
      const { action, word, meaning, pos, hanja, userAnswer } = body;

      if (!word || !action) {
        return new Response(JSON.stringify({ error: 'Missing word or action' }), {
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

      let promptText = "";

      if (action === "context") {
        // 1. 단어 정보 요청 (예문 3개 및 한자 풀이, 사려깊은 뉘앙스)
        promptText = `
너는 고등학생의 수능 국어/고급 어휘 학습을 도와주는 최고의 국어 선생님이야.
학생이 학습할 단어 정보는 다음과 같아:
단어: "${word}"
품사: "${pos || '알 수 없음'}"
기본 뜻: "${meaning || '알 수 없음'}"
한자: "${hanja || '고유어 혹은 알 수 없음'}"

이 정보를 바탕으로 학생이 단어를 완벽히 이해할 수 있도록 다음 3가지 정보를 반드시 JSON 형식으로만 반환해줘. 다른 말은 절대 추가하지 마.

1. "examples": 이 단어가 아주 자연스럽게 사용된 실생활/수능 수준의 예문 3개. (각 예문 안에서 해당 단어 부분은 반드시 HTML <strong> 태그로 감싸야 해!)
2. "detailedMeaning": 이 단어의 숨겨진 뉘앙스나 언제 주로 쓰이는지 부드럽고 친절하게 설명해줘.
3. "hanjaBreakdown": 단어가 한자어라면 각 한자의 뜻과 음을 쪼개서 설명하고, 왜 그런 뜻이 되었는지 어원을 설명해줘. 순우리말(고유어)라면 어원이나 외우기 쉬운 연상법(Mnemonic)을 알려줘.

JSON 파싱 가능한 형태로만 반환하라.
`;
      } else if (action === "grade") {
        // 2. 사용자가 제출한 답안 평가
        if (!userAnswer) {
          return new Response(JSON.stringify({ error: 'Missing userAnswer for grading' }), { status: 400, headers: corsHeaders });
        }
        
        promptText = `
너는 고등학생의 수능 국어/고급 어휘 학습을 도와주는 친절한 전담 국어교사야.
문제로 나온 단어는 "${word}" 이며, (해당 단어의 원래 뜻은 "${meaning || ''}" 이야).
학생이 제출한 이 단어의 뜻풀이는 다음과 같아:
"${userAnswer}"

이 답변이 단어의 본래 의미/뉘앙스와 일치하는지 평가해서 다음 정보를 반드시 JSON 형식으로만 반환해줘. 다른 말은 절대 추가하지 마.

1. "isCorrect": 학생의 문맥 파악이 완벽하다면 "correct", 의미가 좀 통하거나 뉘앙스는 비슷하면 "partial", 아예 틀리거나 상관없는 소리라면 "incorrect" 로 작성해.
2. "feedback": 학생의 뜻풀이를 다정하고 전문적인 선생님 말투로 평가해줘. 왜 맞았는지, 왜 부분점수인지, 혹은 왜 틀렸는지 친절하게 1~2문장으로 설명해야 해.

JSON 파싱 가능한 형태로만 반환하라.
`;
      } else {
        return new Response(JSON.stringify({ error: 'Invalid action. Must be "context" or "grade"' }), { status: 400, headers: corsHeaders });
      }

      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      const geminiResponse = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { 
            temperature: 0.7,
            responseMimeType: "application/json" 
          }
        })
      });

      if (!geminiResponse.ok) {
        const errorDetail = await geminiResponse.text();
        throw new Error(`Gemini API error: ${geminiResponse.status} - ${errorDetail}`);
      }

      const data = await geminiResponse.json();
      
      if (!data.candidates || data.candidates.length === 0) {
         throw new Error(`No candidates in response. Data: ${JSON.stringify(data)}`);
      }

      const textOutput = data.candidates[0].content.parts[0].text;
      
      let resultObj;
      try {
        const cleanJsonStr = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
        resultObj = JSON.parse(cleanJsonStr);
      } catch (e) {
        throw new Error(`JSON Parse Error: ${e.message} \nRaw text: ${textOutput}`);
      }

      return new Response(JSON.stringify(resultObj), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
