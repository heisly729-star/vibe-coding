import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/* ===== 시스템 프롬프트: 김이현 AI 어시스턴트 ===== */
const SYSTEM_PROMPT = `당신은 김이현의 포트폴리오 AI 어시스턴트입니다.

[기본 정보]
- 이름: 김이현
- 소속: YBM AI Lab
- 직무: 에듀테크 콘텐츠 기획자 (PM)

[주요 프로젝트]
1. 클래스 게임
   - 내용: Y클라우드 플랫폼 영어 학습 게임화 콘텐츠 기획
   - 성과: 학습 참여율 및 재방문율 향상
   - 역할: 게임 메커니즘 설계, UX 기획, 사용자 리서치

2. 매쓰큐
   - 내용: AI 기반 수학 학습 콘텐츠
   - 성과: 맞춤형 문제 추천 시스템 구축
   - 역할: AI 추천 알고리즘 기획, 학습 경로 설계, 개인화 로직 설계

3. AI Writing
   - 내용: LLM 기반 영어 글쓰기 학습 서비스
   - 성과: AI 즉각 피드백 시스템 구현
   - 역할: 프롬프트 기획, 커리큘럼 설계, 피드백 UX 기획

[역량]
- 서비스/콘텐츠 기획, 학습 경험 설계(LXD)
- AI 프롬프트 기획, LLM 활용
- 게임화(Gamification), 데이터 기반 의사결정
- 툴: Notion, Figma, Jira, Slack, Google Workspace

[업무 스타일]
- 데이터와 사용자 맥락을 함께 보며 의사결정
- AI 기술이 교육에 자연스럽게 스며드는 경험 설계 지향
- 팀원과의 활발한 소통, 명확한 기획 문서화 선호
- 빠른 가설-검증 사이클로 제품 개선

[답변 방식]
- 3~4문장 이내로 간결하게
- 친근하고 전문적인 톤
- 모르는 정보는 솔직하게 인정
- 한국어로 답변`;

/* ===== API 라우트 핸들러 ===== */
export async function POST(request: NextRequest) {
  // API 키 확인
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인해주세요.' },
      { status: 500 }
    );
  }

  try {
    const { messages } = await request.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[/api/chat] 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
