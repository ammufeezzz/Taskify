import { cn } from "@/lib/utils";
import Link from "next/link";

export function Logo(props: { className?: string, link?: string }) {
  return (
    <Link href={props.link ?? '/'} className={cn("flex items-center space-x-3", props.className)}>
      <div className="flex items-center space-x-3">
        <span className="text-xl font-medium tracking-tight text-foreground">Workedge</span>
      </div>
    </Link>
  );
}
