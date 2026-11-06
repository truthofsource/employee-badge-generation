# Adapted from the actual badge containers and exact-secret reader boundaries.
resource "azurerm_resource_group" "badge_reference" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}
resource "azapi_resource" "badge_containers" {
  for_each  = toset(["employee-badge-headshots", "employee-badge-artifacts"])
  type      = "Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01"
  name      = each.value
  parent_id = "${var.existing_storage_account_id}/blobServices/default"
  body      = { properties = { publicAccess = "None" } }
}
resource "azurerm_user_assigned_identity" "badge_api" {
  name                = "id-example-badge-api"
  resource_group_name = azurerm_resource_group.badge_reference.name
  location            = var.location
  tags                = var.tags
  lifecycle {
    precondition {
      condition     = !var.enable_ai_cleanup || (var.enable_secret_reader && var.openai_secret_resource_id != "" && can(regex("^https://[a-zA-Z0-9-]+[.]vault[.]azure[.]net/secrets/[^/]+/[a-fA-F0-9]{32}$", var.openai_secret_version_uri)))
      error_message = "AI cleanup requires separately reviewed exact-secret access and an exact version URI, never a key value."
    }
  }
}
resource "azurerm_role_assignment" "badge_artifact_contributor" {
  for_each             = azapi_resource.badge_containers
  scope                = each.value.id
  principal_id         = azurerm_user_assigned_identity.badge_api.principal_id
  principal_type       = "ServicePrincipal"
  role_definition_name = "Storage Blob Data Contributor"
}
resource "azurerm_role_assignment" "scanner_container_reader" {
  for_each             = var.scanner_principal_id != "" ? azapi_resource.badge_containers : {}
  scope                = each.value.id
  principal_id         = var.scanner_principal_id
  principal_type       = "ServicePrincipal"
  role_definition_name = "Storage Blob Data Reader"
}
resource "azurerm_role_assignment" "portrait_secret_reader" {
  count                = var.enable_secret_reader ? 1 : 0
  scope                = var.openai_secret_resource_id
  principal_id         = azurerm_user_assigned_identity.badge_api.principal_id
  principal_type       = "ServicePrincipal"
  role_definition_name = "Key Vault Secrets User"
  lifecycle {
    precondition {
      condition     = can(regex("/providers/Microsoft[.]KeyVault/vaults/[^/]+/secrets/[^/]+$", var.openai_secret_resource_id))
      error_message = "Scope the reader to one reviewed secret resource, not a vault or subscription."
    }
  }
}
output "badge_identity_id" { value = azurerm_user_assigned_identity.badge_api.id }
output "badge_container_ids" { value = { for name, container in azapi_resource.badge_containers : name => container.id } }
output "proposed_runtime_controls" {
  value = {
    EMPLOYEE_BADGE_PORTRAIT_CLEANUP_ENABLED = tostring(var.enable_ai_cleanup)
    EMPLOYEE_BADGE_OPENAI_KEY_SECRET_URI    = var.openai_secret_version_uri
  }
  description = "Integration values only; this root does not deploy or reconfigure an application."
}
