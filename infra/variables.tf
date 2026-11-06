variable "subscription_id" { type = string }
variable "location" {
  type    = string
  default = "eastus2"
}
variable "resource_group_name" { type = string }
variable "existing_storage_account_id" {
  type        = string
  description = "Reviewed existing scan-protected account; this root does not create or weaken its network/storage policy."
}
variable "scanner_principal_id" {
  type    = string
  default = ""
}
variable "enable_ai_cleanup" {
  type    = bool
  default = false
}
variable "enable_secret_reader" {
  type    = bool
  default = false
}
variable "openai_secret_resource_id" {
  type    = string
  default = ""
}
variable "openai_secret_version_uri" {
  type    = string
  default = ""
}
variable "tags" {
  type    = map(string)
  default = { environment = "lab", owner = "engineering", managed_by = "terraform", purpose = "employee-badges" }
}
