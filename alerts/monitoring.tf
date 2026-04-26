# alerts/monitoring.tf — Alertas Cloud Monitoring para Call Manager AI
# Ejecutar: terraform init && terraform apply

terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }
}

variable "project_id" { type = string }
variable "alert_email" { type = string  description = "Email para recibir alertas" }

provider "google" { project = var.project_id }

# ── Canal de notificación (email) ────────────────────────────────────────────
resource "google_monitoring_notification_channel" "email" {
  display_name = "CallManager Alerts Email"
  type         = "email"
  labels       = { email_address = var.alert_email }
}

# ── Alerta 1: Cola de escalamientos alta ─────────────────────────────────────
resource "google_monitoring_alert_policy" "escalation_queue_high" {
  display_name = "CallManager — Cola de escalamientos alta"
  combiner     = "OR"

  conditions {
    display_name = "Llamadas en cola > 5"
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/callmanager/call_escalated\" resource.type=\"global\""
      duration        = "300s"   # 5 minutos
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "604800s"   # 7 días
  }

  documentation {
    content   = "La cola de escalamientos tiene más de 5 llamadas en 5 minutos. Verificar disponibilidad de agentes."
    mime_type = "text/markdown"
  }
}

# ── Alerta 2: Error rate del Orchestrator ────────────────────────────────────
resource "google_monitoring_alert_policy" "orchestrator_errors" {
  display_name = "CallManager — Error rate Orchestrator alto"
  combiner     = "OR"

  conditions {
    display_name = "Errores Gemini > 10/5min"
    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/callmanager/gemini_error\" resource.type=\"global\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  documentation {
    content   = "El Orchestrator está reportando muchos errores con Gemini API. Revisar cuota y logs de Cloud Run."
    mime_type = "text/markdown"
  }
}

# ── Alerta 3: Cloud Run Orchestrator latencia alta ───────────────────────────
resource "google_monitoring_alert_policy" "orchestrator_latency" {
  display_name = "CallManager — Latencia Orchestrator alta"
  combiner     = "OR"

  conditions {
    display_name = "P95 latencia > 3s"
    condition_threshold {
      filter     = "resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"callmanager-orchestrator\" metric.type=\"run.googleapis.com/request_latencies\""
      duration   = "300s"
      comparison = "COMPARISON_GT"
      threshold_value = 3000   # ms
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_PERCENTILE_99"
        cross_series_reducer = "REDUCE_MEAN"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  documentation {
    content   = "El Orchestrator tiene latencia P99 > 3s. Esto afecta la experiencia de voz. Verificar STT y Gemini API."
    mime_type = "text/markdown"
  }
}

# ── Output ────────────────────────────────────────────────────────────────────
output "notification_channel" { value = google_monitoring_notification_channel.email.name }
output "alert_policies" {
  value = [
    google_monitoring_alert_policy.escalation_queue_high.name,
    google_monitoring_alert_policy.orchestrator_errors.name,
    google_monitoring_alert_policy.orchestrator_latency.name,
  ]
}
