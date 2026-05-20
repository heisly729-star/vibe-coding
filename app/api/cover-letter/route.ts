import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/* ===== 커버레터 프롬프트 빌더 ===== */
function buildPrompt(company: string, position: string, tone: string): string {
  const toneMap: Record<string, string> = {
    professional: '전문적이고 격식 있는',
    friendly: '친근하고 활기찬',
    concise: '간결하고 임팩트 있는',
  };
  const toneStr = toneMap[tone] ?? '전문적이고 격식 있는';

  return `김이현의 포트폴리오를 방문한 채용담당자를 위해 ${toneStr} 톤의 커버레터를 작성해주세요.

지원 회사: ${company}
지원 포지션: ${position}

지원자 정보:
- 이름: 김이현
- 소속: YBM AI Lab
- 직무: 에듀테크 콘텐츠 기획자 (PM)
- 주요 프로젝트:
  1. 클래스 게임: Y클라우드 플랫폼 영어 학습 게임화 콘텐츠 기획 (참여율·재방문율 향상)
  2. 매쓰큐: AI 기반 수학 학습 콘텐츠, 맞춤형 추천 시스템 설계
  3. AI Writing: LLM 기반 영어 글쓰기 학습, AI 즉각 피드백 시스템 기획
- 역량: 서비스/콘텐츠 기획, 학습 경험 설계(LXD), AI 프롬프트 기획, 게임화, 데이터 기반 의사결정
- 강점: AI 기술의 교육 접목, 사용자 중심 기획, 데이터+맥락 기반 의사결정

${company}에 지원하는 이유와 포지션 적합성을 자연스럽게 담아주세요.
3~4문단, 각 문단 3~4문장으로 작성해주세요. 한국어로 작성.`;
}

/* ===== API 라우트 핸들러 (SSE 스트리밍) ===== */
export async function POST(request: NextRequest) {
  // API 키 확인
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      'data: {"error":"ANTHROPIC_API_KEY가 설정되지 않았습니다."}\n\ndata: [DONE]\n\n',
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      }
    );
  }

  try {
    const { company, position, tone } = await request.json();
    const prompt = buildPrompt(company, position, tone);

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const encoder = new TextEncoder();

    // ReadableStream으로 SSE 스트리밍
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const messageStream = client.messages.stream({
            model: 'claude-haiku-4-5',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }],
          });

          for await (const event of messageStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const data = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('[/api/cover-letter] 스트리밍 오류:', err);
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Nginx 버퍼링 비활성화
      },
    });
  } catch (error) {
    console.error('[/api/cover-letter] 오류:', error);
    return new Response(
      'data: {"error":"서버 오류가 발생했습니다."}\n\ndata: [DONE]\n\n',
      {
        headers: { 'Content-Type': 'text/event-stream' },
      }
    );
  }
}
