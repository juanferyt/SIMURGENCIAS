export type Config = {
  doctors: number;
  triage_staff: number;
  observation_beds: number;
  duration_minutes: number;
  seed: number;
  rng_scheme?: "sha256-v1" | "legacy-v1";
  arrival_profile: "time_varying" | "stationary";
  arrival_rates_per_hour: [number, number, number, number];
  stationary_rate_per_hour: number;
  triage_mean_minutes: number;
  consultation_mean_minutes: number;
  observation_mean_minutes: number;
  observation_probability: number;
  priority_policy: "triage" | "fifo";
};
export const defaults: Config = {
  doctors: 2,
  triage_staff: 1,
  observation_beds: 4,
  duration_minutes: 1440,
  seed: 42,
  arrival_profile: "time_varying",
  arrival_rates_per_hour: [2, 5, 9, 6],
  stationary_rate_per_hour: 5,
  triage_mean_minutes: 5,
  consultation_mean_minutes: 18,
  observation_mean_minutes: 60,
  observation_probability: 0.2,
  priority_policy: "triage",
};
export type Metrics = {
  generated: number;
  treated: number;
  discharged: number;
  abandoned: number;
  active_at_end: number;
  mean_wait_minutes: number | null;
  mean_system_minutes: number | null;
  mean_service_minutes: number | null;
  mean_queue_length: number;
  doctor_utilization: number;
  triage_utilization: number;
  bed_utilization: number;
  mean_active: number;
  p50_wait_minutes?: number | null;
  p95_wait_minutes?: number | null;
  p99_wait_minutes?: number | null;
  throughput_per_hour?: number;
  max_queue_length?: number;
  probability_wait?: number | null;
};
export type Reference = {
  lambda_per_minute?: number;
  mu_per_minute?: number;
  c?: number;
  P0?: number | null;
  Pq?: number | null;
  rho: number;
  stable: boolean;
  Wq: number | null;
  W: number | null;
  Lq: number | null;
  L: number | null;
  reason?: string;
};
export type Run = {
  patients?: SimulatedPatient[];
  id: string;
  created_at: string;
  config: Config;
  metrics: Metrics;
  elapsed_seconds: number;
  timeline: {
    minute: number;
    doctor_queue: number;
    triage_queue: number;
    observation_queue: number;
    active: number;
  }[];
  theory: {
    compatible: boolean;
    reference: Reference | null;
    reason: string;
    difference_Wq?: number | null;
  };
  little: {
    L_observed: number;
    lambda_observed_per_minute: number;
    W_observed_minutes: number | null;
    lambda_W: number | null;
    difference: number | null;
    censored_contribution: number;
    explanation: string;
  };
};
export type SimulatedPatient = {
  id: number;
  triage_level: number;
  arrival: number;
  triage_start: number | null;
  consultation_start: number | null;
  consultation_end: number | null;
  departure: number | null;
  state: string;
};
export type History = Pick<Run, "id" | "created_at" | "config" | "metrics">;
export type Patient = { id: number; code: string; triage_level: number };
export type Attention = { id: number; patient_id: number; stage: string };
export type Resources = {
  id: number;
  doctors: number;
  triage_staff: number;
  observation_beds: number;
};
export type Telemetry = {
  management: {
    active_patients: number;
    queued_patients: number;
    busy_doctors: number;
    available_doctors: number;
  };
  technical: {
    max_concurrent_simulations: number;
    active_simulations: number;
    completed_simulations: number;
    rejected_simulations: number;
    requests_processed: number;
    internal_queue_capacity: number;
  };
};
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res
      .json()
      .catch(() => ({ detail: `Error HTTP ${res.status}` }));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail),
    );
  }
  return res.json();
}
