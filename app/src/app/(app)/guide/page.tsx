import Link from "next/link";
import {
  CircleHelp,
  ClipboardList,
  FilePenLine,
  Layers3,
  MessageSquareText,
  UsersRound,
} from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

const hierarchy = [
  {
    label: "브랜드",
    description: "여러 프로젝트를 구분하는 가장 바깥 단위",
    className: "",
  },
  {
    label: "프로젝트",
    description: "달성하려는 하나의 목표와 기간",
    className: "ml-3 border-l border-separator pl-4 sm:ml-8 sm:pl-6",
  },
  {
    label: "주요 업무",
    description: "담당자와 상태, 마감일을 가진 실행 단위",
    className: "ml-6 border-l border-separator pl-4 sm:ml-16 sm:pl-6",
  },
  {
    label: "하위 업무",
    description: "업무를 실제 실행 단계로 나눈 더 작은 단위",
    className: "ml-9 border-l border-separator pl-4 sm:ml-24 sm:pl-6",
  },
] as const;

const steps = [
  {
    icon: ClipboardList,
    title: "홈에서 업무의 맥락을 먼저 봅니다",
    description:
      "홈은 할 일 목록이 아니라 업무 지도입니다. 브랜드·프로젝트·주요 업무·하위 업무를 따라 내려가며 어느 일이 어떤 목표에 연결되는지, 어느 단계까지 진행됐는지 한눈에 확인합니다.",
    href: "/home",
    action: "업무 지도 열기",
    layout: "md:col-span-7",
  },
  {
    icon: FilePenLine,
    title: "업무를 열어 세부 내용을 남깁니다",
    description:
      "업무 하나를 누르면 상세 화면이 열립니다. 여기에서 설명, 상태, 담당자, 마감일을 업데이트하고 필요한 일을 하위 업무로 나눕니다. 업무의 최신 정보는 이 한곳에 모입니다.",
    href: "/my-work",
    action: "내 업무 열기",
    layout: "md:col-span-5",
  },
  {
    icon: MessageSquareText,
    title: "댓글로 피드백의 흐름을 이어갑니다",
    description:
      "확인 질문, 검토 의견, 진행 업데이트는 해당 업무의 댓글에 남깁니다. @이름으로 동료를 부를 수 있고, 새 댓글은 알림과 업무함에서 다시 확인할 수 있어 대화가 업무 맥락에서 분리되지 않습니다.",
    href: "/home",
    action: "업무 찾아보기",
    layout: "md:col-span-5",
  },
  {
    icon: UsersRound,
    title: "팀 화면에서 담당자 기준으로 확인합니다",
    description:
      "누가 무엇을 하고 있는지 먼저 알고 싶을 때는 팀으로 갑니다. 구성원별 진행 업무와 이번 주 마감, 기한 초과, 완료 건수를 보고 필요한 업무를 바로 열어볼 수 있습니다.",
    href: "/team",
    action: "팀 현황 보기",
    layout: "md:col-span-7",
  },
] as const;

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl break-keep px-4 py-8 sm:px-6 sm:py-12">
      <header className="relative isolate max-w-3xl overflow-hidden rounded-2xl border border-separator bg-surface px-5 py-7 shadow-sm sm:px-8 sm:py-9">
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-accent/10 blur-2xl"
          aria-hidden
        />
        <div className="relative mb-4 flex size-10 items-center justify-center rounded-xl bg-accent/12 text-accent">
          <CircleHelp className="size-5" aria-hidden />
        </div>
        <p className="relative text-sm font-semibold text-accent">처음 사용하는 분을 위한 안내</p>
        <h1 className="relative mt-2 text-balance text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          업무의 맥락과 대화를 한곳에서
        </h1>
        <p className="relative mt-3 max-w-2xl text-base leading-relaxed text-text-secondary">
          이 도구는 업무를 계층으로 정리해 전체적으로 제시하고 각 업무 안에 실행 정보와
          피드백을 쌓는 방식으로 작동합니다. 이 체계도 만으로 셋중 누가 자리를 비워도 업무가 매끄럽게 흘러가게 하는게 목표입니다.
        </p>
      </header>

      <section
        className="mt-10 rounded-2xl border border-separator bg-surface p-5 shadow-sm sm:p-7"
        aria-labelledby="hierarchy-title"
      >
        <div className="flex items-center gap-2">
          <Layers3 className="size-5 text-accent" aria-hidden />
          <h2 id="hierarchy-title" className="text-xl font-semibold text-text">
            업무의 하이어라키에 따른 분류체계
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
          홈에서는 각 브랜드 별로 체계별 업무가 어떻게 구분되어 있고 진행되는지 알 수 있습니다.
        </p>
        <ol className="mt-6 space-y-2" aria-label="업무 계층">
          {hierarchy.map(({ label, description, className }, index) => (
            <li key={label} className={className}>
              <div className="flex items-start gap-3 rounded-xl border border-separator bg-surface-2/70 px-4 py-3 transition-[transform,background-color,border-color] duration-base ease-out hover:-translate-y-0.5 hover:border-border hover:bg-surface">
                <span className="pt-0.5 text-2xs font-semibold tabular-nums text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-semibold text-text">{label}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-tertiary">{description}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12" aria-labelledby="guide-steps-title">
        <h2 id="guide-steps-title" className="text-xl font-semibold text-text">
          이 구조를 이렇게 사용합니다
        </h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-12">
          {steps.map(({ icon: Icon, title, description, href, action, layout }, index) => (
            <li key={title} className={layout}>
              <Card className="h-full overflow-hidden">
                <CardContent className="flex h-full flex-col p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-semibold text-text-secondary">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <Icon className="mb-3 size-5 text-accent" aria-hidden />
                      <h3 className="text-lg font-semibold text-text">{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                        {description}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="link" className="mt-5 w-fit">
                    <Link href={href}>{action}</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="mt-8 rounded-2xl border border-separator bg-surface-2/60 p-5 sm:p-6"
        aria-labelledby="tip-title"
      >
        <h2 id="tip-title" className="text-lg font-semibold text-text">
          지수의 업무를 확인할 때
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          <Link href="/team" className="font-medium text-accent hover:text-accent-hover hover:underline">
            팀
          </Link>
          에서 지수의 카드를 열고 진행 중인 업무를 누르세요. 업무가 전체 구조 안에서 어디에
          있는지, 현재 상태와 마감일이 무엇인지, 최근 댓글에서 어떤 피드백이 오갔는지를 함께
          보면 별도 문의 없이도 현재 상황을 파악할 수 있습니다.
        </p>
      </section>
    </div>
  );
}
