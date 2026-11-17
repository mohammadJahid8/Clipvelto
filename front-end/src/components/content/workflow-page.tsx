import { ArticleImage } from "./article-image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Captions,
  ChevronDown,
  Frame,
  Play,
} from "lucide-react";
import { ContentShell } from "./content-shell";
import { ContentSections } from "./content-sections";
import { ArticleCards } from "./article-cards";
import { StructuredData } from "./structured-data";
import type { Workflow } from "@/content/workflows";
import { articles } from "@/content/articles";
import { absoluteUrl, breadcrumbData } from "@/lib/seo";

const icons = [Frame, Captions, Play];
export function WorkflowPage({ workflow }: { workflow: Workflow }) {
  return (
    <ContentShell>
      <StructuredData
        data={breadcrumbData([
          { name: "Home", path: "/" },
          { name: workflow.title, path: `/${workflow.slug}` },
        ])}
      />
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: workflow.title,
          description: workflow.description,
          url: absoluteUrl(`/${workflow.slug}`),
          isPartOf: { "@id": absoluteUrl("/#website") },
        }}
      />
      <div className="container">
        <nav aria-label="Breadcrumb" className="content-breadcrumb">
          <Link href="/">Home</Link>
          <ArrowRight size={14} aria-hidden="true" />
          <span aria-current="page">
            {workflow.slug === "youtube-to-shorts"
              ? "YouTube to Shorts"
              : "Podcast clip maker"}
          </span>
        </nav>
        <header className="workflow-hero">
          <div>
            <h1>{workflow.heading}</h1>
            <p>{workflow.intro}</p>
            <div className="workflow-actions">
              <Link href="/#start" className="button button-primary">
                Try a free preview <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/dashboard/upload" className="content-text-link">
                Open workspace <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <p className="workflow-trial-note">
              One watermarked trial preview. Account tools include format and
              caption choices.
            </p>
          </div>
          <ArticleImage
            src={workflow.image}
            alt={workflow.imageAlt}
            caption={workflow.imageCaption}
            source={workflow.imageSource}
            priority
          />
        </header>
        <section className="workflow-benefits" aria-label="What you can do">
          {workflow.benefits.map((benefit, index) => {
            const Icon = icons[index];
            return (
              <article key={benefit.title}>
                <Icon size={26} aria-hidden="true" />
                <h2>{benefit.title}</h2>
                <p>{benefit.text}</p>
              </article>
            );
          })}
        </section>
        <section
          className="workflow-steps"
          aria-labelledby="workflow-steps-title"
        >
          <h2 id="workflow-steps-title">
            One submission. A clear path to your clips.
          </h2>
          <ol>
            {workflow.steps.map((step, index) => (
              <li key={step.title}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="workflow-reading editorial-prose">
          <ContentSections sections={workflow.sections} />
        </div>
        <section
          className="workflow-faq"
          aria-labelledby="workflow-questions-title"
        >
          <h2 id="workflow-questions-title">Questions before you start?</h2>
          {workflow.questions.map((item) => (
            <details key={item.question}>
              <summary>
                <span>{item.question}</span>
                <ChevronDown size={20} aria-hidden="true" />
              </summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </section>
        <section
          className="article-related"
          aria-labelledby="workflow-guides-title"
        >
          <div className="content-section-heading">
            <h2 id="workflow-guides-title">Related reading</h2>
            <Link href="/blog" className="content-text-link">
              Blog <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <ArticleCards
            posts={articles.filter(
              (post) => post.productPath === `/${workflow.slug}`,
            )}
          />
        </section>
      </div>
    </ContentShell>
  );
}
