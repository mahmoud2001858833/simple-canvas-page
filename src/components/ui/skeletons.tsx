import { Skeleton } from "./skeleton";

// Table Row Skeleton
export const TableRowSkeleton = ({ columns = 5 }: { columns?: number }) => (
  <tr className="border-b border-border/50">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="p-4">
        <Skeleton className="h-4 w-full max-w-[120px]" />
      </td>
    ))}
  </tr>
);

// Table Skeleton
export const TableSkeleton = ({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) => (
  <div className="w-full">
    <div className="border-b border-border/50 bg-muted/30">
      <div className="flex p-4 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
    </div>
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex p-4 gap-4 border-b border-border/30 animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" style={{ maxWidth: j === 0 ? '200px' : '120px' }} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// User Row Skeleton (with avatar)
export const UserRowSkeleton = () => (
  <div className="flex items-center gap-4 p-4 border-b border-border/30">
    <Skeleton className="w-10 h-10 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
    <Skeleton className="h-4 w-40" />
    <Skeleton className="h-6 w-16 rounded-full" />
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-8 w-16 rounded" />
  </div>
);

// Users Table Skeleton
export const UsersTableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="w-full">
    <div className="border-b border-border/50 bg-muted/30 p-4">
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <UserRowSkeleton key={i} />
    ))}
  </div>
);

// Course Row Skeleton
export const CourseRowSkeleton = () => (
  <div className="flex items-center gap-4 p-4 border-b border-border/30">
    <Skeleton className="w-12 h-10 rounded-lg" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-3 w-20" />
    </div>
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-4 w-16" />
    <Skeleton className="h-6 w-12 rounded-full" />
    <Skeleton className="h-6 w-10 rounded-full" />
    <div className="flex gap-2">
      <Skeleton className="h-8 w-8 rounded" />
      <Skeleton className="h-8 w-8 rounded" />
    </div>
  </div>
);

// Courses Table Skeleton
export const CoursesTableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="w-full">
    <div className="border-b border-border/50 bg-muted/30 p-4">
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <CourseRowSkeleton key={i} />
    ))}
  </div>
);

// Payment Row Skeleton
export const PaymentRowSkeleton = () => (
  <div className="flex items-center gap-4 p-4 border-b border-border/30">
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-40" />
    </div>
    <Skeleton className="h-4 w-20 font-bold" />
    <Skeleton className="h-6 w-16 rounded-full" />
    <Skeleton className="h-6 w-16 rounded-full" />
    <Skeleton className="h-4 w-24" />
    <div className="flex gap-2">
      <Skeleton className="h-8 w-16 rounded" />
      <Skeleton className="h-8 w-8 rounded" />
    </div>
  </div>
);

// Payments Table Skeleton
export const PaymentsTableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="w-full">
    <div className="border-b border-border/50 bg-muted/30 p-4">
      <div className="flex gap-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <PaymentRowSkeleton key={i} />
    ))}
  </div>
);

// Stat Card Skeleton
export const StatCardSkeleton = () => (
  <div className="card-premium p-6 animate-pulse">
    <div className="flex items-start justify-between mb-4">
      <Skeleton className="w-12 h-12 rounded-xl" />
      <Skeleton className="h-5 w-12 rounded-full" />
    </div>
    <Skeleton className="h-8 w-20 mb-2" />
    <Skeleton className="h-4 w-32" />
  </div>
);

// Stats Grid Skeleton
export const StatsGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <StatCardSkeleton key={i} />
    ))}
  </div>
);

// Card Skeleton
export const CardSkeleton = () => (
  <div className="card-premium p-6 space-y-4 animate-pulse">
    <div className="flex items-center gap-3">
      <Skeleton className="w-12 h-12 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </div>
);

// Course Card Skeleton
export const CourseCardSkeleton = () => (
  <div className="card-premium overflow-hidden animate-pulse">
    <Skeleton className="w-full h-48" />
    <div className="p-5 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  </div>
);

// List Item Skeleton
export const ListItemSkeleton = () => (
  <div className="flex items-center gap-4 p-4 border-b border-border/30 animate-pulse">
    <Skeleton className="w-10 h-10 rounded-lg" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-3 w-32" />
    </div>
    <Skeleton className="h-8 w-20 rounded" />
  </div>
);

// List Skeleton
export const ListSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="w-full">
    {Array.from({ length: rows }).map((_, i) => (
      <ListItemSkeleton key={i} />
    ))}
  </div>
);

// Student Dashboard Skeletons
export const StudentStatsSkeleton = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const CourseCardSkeleton2 = () => (
  <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
    <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <Skeleton className="h-5 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-3" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  </div>
);

export const MyCoursesSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="rounded-xl border bg-card">
    <div className="p-6 border-b">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
    <div className="p-6 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <CourseCardSkeleton2 key={i} />
      ))}
    </div>
  </div>
);

export const ScheduleItemSkeleton = () => (
  <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
    <div className="text-center">
      <Skeleton className="h-6 w-10 mb-1" />
      <Skeleton className="h-4 w-8 mx-auto" />
    </div>
    <div className="flex-1">
      <Skeleton className="h-5 w-2/3 mb-2" />
      <Skeleton className="h-4 w-1/2" />
    </div>
    <Skeleton className="h-6 w-16 rounded-full" />
  </div>
);

export const WeeklyScheduleSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="rounded-xl border bg-card">
    <div className="p-6 border-b">
      <Skeleton className="h-6 w-40" />
    </div>
    <div className="p-6 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <ScheduleItemSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const ProgressItemSkeleton = () => (
  <div className="p-4 rounded-xl border bg-card">
    <div className="flex items-center justify-between mb-3">
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-4 w-16" />
    </div>
    <Skeleton className="h-2 w-full rounded-full mb-2" />
    <Skeleton className="h-4 w-24" />
  </div>
);

export const ProgressOverviewSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="rounded-xl border bg-card">
    <div className="p-6 border-b">
      <Skeleton className="h-6 w-32" />
    </div>
    <div className="p-6 grid gap-4 md:grid-cols-2">
      {Array.from({ length: rows }).map((_, i) => (
        <ProgressItemSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const CertificateCardSkeleton = () => (
  <div className="p-4 rounded-xl border bg-card">
    <div className="flex items-start gap-4">
      <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-5 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-2" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
    <div className="flex gap-2 mt-4">
      <Skeleton className="h-9 flex-1" />
      <Skeleton className="h-9 flex-1" />
    </div>
  </div>
);

export const CertificatesSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="rounded-xl border bg-card">
    <div className="p-6 border-b">
      <Skeleton className="h-6 w-32" />
    </div>
    <div className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: rows }).map((_, i) => (
        <CertificateCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Instructor Dashboard Skeletons
export const InstructorStatsSkeleton = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const InstructorCourseCardSkeleton = () => (
  <div className="p-4 rounded-xl border bg-card">
    <div className="flex items-start gap-4">
      <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-5 w-2/3 mb-2" />
        <div className="flex items-center gap-4 mb-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-9 w-20" />
    </div>
  </div>
);

export const InstructorCoursesSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="rounded-xl border bg-card">
    <div className="p-6 border-b flex items-center justify-between">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-28" />
    </div>
    <div className="p-6 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <InstructorCourseCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const StudentRowSkeleton = () => (
  <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
    <Skeleton className="w-12 h-12 rounded-full" />
    <div className="flex-1 min-w-0">
      <Skeleton className="h-5 w-1/3 mb-1" />
      <Skeleton className="h-4 w-1/4 mb-1" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <div className="flex flex-col items-end gap-2">
      <Skeleton className="h-6 w-16 rounded-full" />
      <div className="flex items-center gap-2 w-32">
        <Skeleton className="h-2 flex-1 rounded-full" />
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  </div>
);

export const InstructorStudentsSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="rounded-xl border bg-card">
    <div className="p-6 border-b">
      <Skeleton className="h-6 w-24" />
    </div>
    <div className="p-6">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full md:w-[200px]" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <StudentRowSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
);

export const LiveSessionSkeleton = () => (
  <div className="p-4 rounded-xl border bg-card">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-5 w-2/3 mb-1" />
        <Skeleton className="h-4 w-1/2 mb-3" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  </div>
);

export const InstructorScheduleSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="rounded-xl border bg-card">
    <div className="p-6 border-b">
      <Skeleton className="h-6 w-36" />
    </div>
    <div className="p-6 space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <LiveSessionSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const EarningsSummarySkeleton = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="rounded-xl border bg-card p-4">
        <Skeleton className="w-10 h-10 rounded-lg mb-3" />
        <Skeleton className="h-4 w-20 mb-1" />
        <Skeleton className="h-6 w-24" />
      </div>
    ))}
  </div>
);

export const EarningRowSkeleton = () => (
  <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
    <Skeleton className="w-10 h-10 rounded-lg" />
    <div className="flex-1 min-w-0">
      <Skeleton className="h-5 w-1/2 mb-1" />
      <Skeleton className="h-4 w-1/3" />
    </div>
    <div className="flex flex-col items-end gap-1">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  </div>
);

export const InstructorEarningsSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="space-y-6">
    <EarningsSummarySkeleton />
    <div className="rounded-xl border bg-card">
      <div className="p-6 border-b">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="p-6 space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <EarningRowSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
);

export const ConversationSkeleton = () => (
  <div className="flex items-center gap-3 p-4 border-b">
    <Skeleton className="w-10 h-10 rounded-full" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="h-4 w-3/4" />
    </div>
  </div>
);

export const InstructorMessagesSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="rounded-xl border bg-card h-[calc(100vh-200px)] flex flex-col">
    <div className="p-6 border-b">
      <Skeleton className="h-6 w-24" />
    </div>
    <div className="p-4 border-b">
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="flex-1">
      {Array.from({ length: rows }).map((_, i) => (
        <ConversationSkeleton key={i} />
      ))}
    </div>
  </div>
);
