{{/*
  forgeportal.fullname
*/}}
{{- define "forgeportal.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "forgeportal" .Values.nameOverride }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
  forgeportal.labels
*/}}
{{- define "forgeportal.labels" -}}
helm.sh/chart: {{ include "forgeportal.chart" . }}
app.kubernetes.io/name: {{ include "forgeportal.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}

{{- define "forgeportal.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "forgeportal.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
  Image pull spec for API/Worker/UI (same image by default).
  Usage: {{ include "forgeportal.image" (dict "root" . "component" .Values.api) }}
*/}}
{{- define "forgeportal.image" -}}
{{- $root := .root -}}
{{- $comp := .component -}}
{{- $img := merge (default dict $root.Values.image) (default dict $comp.image) -}}
{{- $reg := default "" $img.registry -}}
{{- $repo := $img.repository -}}
{{- $tag := default $root.Chart.AppVersion $img.tag -}}
{{- if $reg }}{{ $reg }}/{{ $repo }}:{{ $tag }}{{- else }}{{ $repo }}:{{ $tag }}{{- end }}
{{- end }}

{{/*
  DB connection: host, port, name, user (for API/Worker when internal or external DB)
*/}}
{{- define "forgeportal.dbHost" -}}
{{- if .Values.externalDatabase.enabled }}{{ .Values.externalDatabase.host }}{{- else }}{{ include "forgeportal.fullname" . }}-postgres{{- end }}
{{- end }}

{{- define "forgeportal.dbPort" -}}
{{- if .Values.externalDatabase.enabled }}{{ .Values.externalDatabase.port | toString }}{{- else }}5432{{- end }}
{{- end }}

{{- define "forgeportal.dbName" -}}
{{- if .Values.externalDatabase.enabled }}{{ .Values.externalDatabase.database }}{{- else }}{{ .Values.postgres.auth.database }}{{- end }}
{{- end }}

{{- define "forgeportal.dbUser" -}}
{{- if .Values.externalDatabase.enabled }}{{ .Values.externalDatabase.username }}{{- else }}{{ .Values.postgres.auth.username }}{{- end }}
{{- end }}

{{/*
  Secret name for DB password (internal: postgres secret or app secret; external: existingSecret)
*/}}
{{- define "forgeportal.dbSecretName" -}}
{{- if .Values.externalDatabase.enabled }}
{{- .Values.externalDatabase.existingSecret | required "externalDatabase.enabled requires externalDatabase.existingSecret" }}
{{- else if .Values.postgres.auth.existingSecret }}
{{- .Values.postgres.auth.existingSecret }}
{{- else if .Values.secrets.createDefaultSecret }}
{{- include "forgeportal.fullname" . }}-secret
{{- else if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- include "forgeportal.fullname" . }}-secret
{{- end }}
{{- end }}

{{- define "forgeportal.dbPasswordKey" -}}
{{- if .Values.externalDatabase.enabled }}db-password{{- else if .Values.postgres.auth.existingSecret }}password{{- else }}db-password{{- end }}
{{- end }}
