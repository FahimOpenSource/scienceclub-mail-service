import { ArrowLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"

export default function MailLoading() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to inbox
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-5 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" />
              Loading message&hellip;
            </div>

            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="mt-2 h-7 w-1/2" />

            <div className="mt-5 flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>

            <Separator className="my-5" />

            <div className="space-y-2.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-[95%]" />
              <Skeleton className="h-3 w-[88%]" />
              <Skeleton className="h-3 w-[92%]" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-[85%]" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
