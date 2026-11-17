import { WorkflowPage } from "@/components/content/workflow-page";
import { workflows } from "@/content/workflows";
import { publicMetadata } from "@/lib/seo";

const workflow = workflows[0];
export const metadata = publicMetadata({
  title: workflow.title,
  description: workflow.description,
  path: `/${workflow.slug}`,
});
export default function Page() {
  return <WorkflowPage workflow={workflow} />;
}
