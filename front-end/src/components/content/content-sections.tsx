import Link from "next/link";
import { ArticleImage } from "./article-image";
import type { ContentSection } from "@/content/articles";

export function ContentSections({ sections }: { sections: ContentSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <section id={section.id} key={section.id} className="editorial-section">
          <h2>{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.image && <ArticleImage {...section.image} />}
          {section.items && (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.table && (
            <div
              className="editorial-table-wrap"
              role="region"
              aria-label={section.title}
              tabIndex={0}
            >
              <table>
                <caption>{section.title}</caption>
                <thead>
                  <tr>
                    {section.table.headings.map((heading) => (
                      <th scope="col" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell, index) =>
                        index === 0 ? (
                          <th scope="row" key={cell}>
                            {cell}
                          </th>
                        ) : (
                          <td key={cell}>{cell}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {section.links && (
            <div className="editorial-references">
              {section.links.map((link) =>
                link.href.startsWith("/") ? (
                  <Link
                    href={
                      link.href.startsWith("/blog/") && !link.href.includes("#")
                        ? `${link.href}#top`
                        : link.href
                    }
                    key={link.href}
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    href={link.href}
                    key={link.href}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {link.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ),
              )}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
