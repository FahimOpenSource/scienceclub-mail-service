"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

type Step = "email" | "login" | "signup" | "success"

type CheckEmailResponse = {
  error?: string
  exists?: boolean
  userId?: string | null
  isConfirmed?: boolean
  hasProfile?: boolean
  canSignup?: boolean
}

export type ClassOption = {
  id: number
  name: string
  streams: {
    classStreamId: number
    name: string
  }[]
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function streamLabel(name: string) {
  return name === name.toLowerCase() ? name.toUpperCase() : `Stream ${name}`
}

async function validateActiveProfile(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("status")
    .maybeSingle()

  if (error) {
    return error.message
  }

  if (!data) {
    return "Your profile is not set up yet"
  }

  if (data.status !== "active") {
    return "Your account is not active"
  }

  return null
}

export function AuthForm({
  className,
  classOptions,
}: {
  className?: string
  classOptions: ClassOption[]
}) {
  const router = useRouter()
  const [step, setStep] = React.useState<Step>("email")
  const [checking, setChecking] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)
  const [showConfirm, setShowConfirm] = React.useState(false)

  const [email, setEmail] = React.useState("")
  const [fullName, setFullName] = React.useState("")
  const [klass, setKlass] = React.useState("")
  const [stream, setStream] = React.useState("")
  const [boarding, setBoarding] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")

  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const selectedClass = React.useMemo(
    () => classOptions.find((option) => String(option.id) === klass),
    [classOptions, klass],
  )

  const streams = selectedClass?.streams ?? []

  // Reset stream when class changes.
  React.useEffect(() => {
    setStream("")
  }, [klass])

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!email.trim()) next.email = "Email is required"
    else if (!isValidEmail(email)) next.email = "Enter a valid email"
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setChecking(true)
    try {
      const response = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data: CheckEmailResponse = await response.json()

      if (!response.ok) {
        setErrors({ email: data.error ?? "Could not check email" })
        return
      }

      if (!data.exists) {
        setErrors({ email: "No account was found for this email" })
        return
      }

      setStep(data.canSignup ? "signup" : "login")
    } catch {
      setErrors({ email: "Could not check email" })
    } finally {
      setChecking(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!password) next.password = "Password is required"
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setErrors({ password: error.message })
      setSubmitting(false)
      return
    }

    const profileError = await validateActiveProfile(supabase)

    if (profileError) {
      await supabase.auth.signOut()
      setErrors({ password: profileError })
      setSubmitting(false)
      return
    }
    router.push("/")
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!fullName.trim()) next.fullName = "Full name is required"
    if (!klass) next.klass = "Select a class"
    if (!stream) next.stream = "Select a stream"
    if (!password) next.password = "Password is required"
    else if (password.length < 8) next.password = "Use at least 8 characters"
    if (!confirmPassword) next.confirmPassword = "Confirm your password"
    else if (password !== confirmPassword)
      next.confirmPassword = "Passwords do not match"
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          classStreamId: Number(stream),
          boarding,
        }),
      })
      const data: { error?: string } = await response.json()

      if (!response.ok) {
        setErrors({ form: data.error ?? "Could not create account" })
        return
      }

      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        setErrors({ form: error.message })
        return
      }

      const profileError = await validateActiveProfile(supabase)

      if (profileError) {
        await supabase.auth.signOut()
        setErrors({ form: profileError })
        return
      }

      router.push("/")
    } catch {
      setErrors({ form: "Could not create account" })
    } finally {
      setSubmitting(false)
    }
  }

  function handleBack() {
    setErrors({})
    setPassword("")
    setConfirmPassword("")
    setStep("email")
  }

  return (
    <Card className={cn("w-full max-w-md border-border/60", className)}>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold tracking-tight">
            {step === "email" && "Welcome"}
            {step === "login" && "Welcome back"}
            {step === "signup" && "Create your account"}
            {step === "success" && "You're all set"}
          </CardTitle>
          {(step === "login" || step === "signup") && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-8 gap-1 text-muted-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </Button>
          )}
        </div>
        <CardDescription className="text-pretty">
          {step === "email" &&
            "Enter the email assigned to your account."}
          {step === "login" && (
            <>
              Signing in as{" "}
              <span className="font-medium text-foreground">{email}</span>
            </>
          )}
          {step === "signup" && (
            <>
              Finish setting up your account for{" "}
              <span className="font-medium text-foreground">{email}</span>
            </>
          )}
          {step === "success" && "Your session has started. Redirecting..."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {step === "email" && (
          <form onSubmit={handleEmailContinue} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="your_name@scienceclublss.me"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
              </div>
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">
                  {errors.email}
                </p>
              )}
              {/* <p className="text-xs text-muted-foreground">
                Tip: try{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={() => setEmail("demo@example.com")}
                >
                  demo@example.com
                </button>{" "}
                for an existing account.
              </p> */}
            </div>

            <Button type="submit" disabled={checking} className="w-full">
              {checking ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {step === "login" && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  autoFocus
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-xs text-destructive">
                  {errors.password}
                </p>
              )}
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        )}

        {step === "signup" && (
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                autoFocus
                placeholder="Jane Nakato"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={!!errors.fullName}
                aria-describedby={
                  errors.fullName ? "fullName-error" : undefined
                }
              />
              {errors.fullName && (
                <p id="fullName-error" className="text-xs text-destructive">
                  {errors.fullName}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="class">Class</Label>
                <Select value={klass} onValueChange={setKlass}>
                  <SelectTrigger
                    id="class"
                    className="h-9 w-full rounded-md text-sm"
                    aria-invalid={!!errors.klass}
                  >
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classOptions.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        Senior {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.klass && (
                  <p className="text-xs text-destructive">{errors.klass}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="stream">Stream</Label>
                <Select
                  value={stream}
                  onValueChange={setStream}
                  disabled={!klass}
                >
                  <SelectTrigger
                    id="stream"
                    className="h-9 w-full rounded-md text-sm"
                    aria-invalid={!!errors.stream}
                  >
                    <SelectValue
                      placeholder={klass ? "Select stream" : "Pick class first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {streams.map((s) => (
                      <SelectItem
                        key={s.classStreamId}
                        value={String(s.classStreamId)}
                      >
                        {streamLabel(s.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.stream && (
                  <p className="text-xs text-destructive">{errors.stream}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-muted/30 px-3 py-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <BedDouble className="size-4" />
                </div>
                <div className="space-y-0.5">
                  <Label htmlFor="boarding" className="text-sm font-medium">
                    Boarding student
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Are you a boarding student?
                  </p>
                </div>
              </div>
              <Switch
                id="boarding"
                checked={boarding}
                onCheckedChange={setBoarding}
                aria-label="Boarding student"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 pr-10"
                  aria-invalid={!!errors.confirmPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {errors.form && (
              <p className="text-xs text-destructive">{errors.form}</p>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              You&apos;re signed in as{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEmail("")
                setFullName("")
                setKlass("")
                setStream("")
                setBoarding(false)
                setPassword("")
                setConfirmPassword("")
                setStep("email")
              }}
            >
              Use a different account
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
