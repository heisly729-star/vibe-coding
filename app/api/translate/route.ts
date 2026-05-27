import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/* ===== BOM 문자 제거 유틸 ===== */
function cleanApiKey(key: string | undefined): string | undefined {
  // PowerShell 파이프 등으로 BOM(﻿)이 앞에 붙는 경우 제거
  return key?.replace(/^﻿/, '').trim();
}

/* ===== 입력값 제한 상수 ===== */
const MAX_TEXT_LENGTH = 3000;  // 번역 원문 최대 글자 수 (커버레터 상한)

/* ===== SSE 에러 응답 헬퍼 ===== */
function sseError(msg: string, status = 400) {
  return new Response(
    `data: ${JSON.stringify({ error: msg })}\n\ndata: [DONE]\n\n`,
    { status, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
  );
}

/* ===== API 라우트 핸들러 (SSE 스트리밍) ===== */
export async function POST(request: NextRequest) {
  const apiKey = cleanApiKey(process.env.ANTHROPIC_API_KEY);

  // API 키 확인 (내부 경로 노출 제거)
  if (!apiKey) return sseError('서버 설정 오류입니다.', 500);

  try {
    const { text } = await request.json();

    // ── 입력값 검증 ──────────────────────────────────────────
    if (!text || typeof text !== 'string') return sseError('잘못된 요청입니다.');
    if (text.length > MAX_TEXT_LENGTH) return sseError('텍스트가 너무 깁니다.');
    // ──────────────────────────────────────────────────────────

    const prompt = `아래 한국어 커버레터를 자연스럽고 전문적인 영어로 번역해주세요.
원문의 톤·뉘앙스를 살리되, 영어 커버레터의 표현 방식에 맞게 다듬어주세요.
번역문만 출력하고 다른 설명은 하지 마세요.

[원문]
${text}`;

    const client = new Anthropic({ apiKey });
    const encoder = new TextEncoder();

    // ReadableStream으로 SSE 스트리밍
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const messageStream = client.messages.stream({
            model: 'claude-haiku-4-5',
            max_tokens: 2000,
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
          console.error('[/api/translate] 스트리밍 오류:', err);
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
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[/api/translate] 오류:', error);
    return new Response(
      'data: {"error":"서버 오류가 발생했습니다."}\n\ndata: [DONE]\n\n',
      {
        headers: { 'Content-Type': 'text/event-stream' },
      }
    );
  }
}
