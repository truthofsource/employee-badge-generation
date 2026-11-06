mock_provider "azurerm" {}
mock_provider "azapi" {}
variables {
  subscription_id             = "00000000-0000-0000-0000-000000000001"
  resource_group_name         = "rg-example-badges"
  existing_storage_account_id = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/rg-example-storage/providers/Microsoft.Storage/storageAccounts/stexamplebadges001"
}
run "two_private_containers_without_ai_activation" {
  command = plan
  assert {
    condition     = length(azapi_resource.badge_containers) == 2 && alltrue([for item in azapi_resource.badge_containers : item.body.properties.publicAccess == "None"])
    error_message = "Badge containers must remain private."
  }
  assert {
    condition     = length(azurerm_role_assignment.portrait_secret_reader) == 0 && length(azurerm_role_assignment.scanner_container_reader) == 0
    error_message = "Optional grants require explicit inputs."
  }
}
run "ai_requires_a_versioned_secret_binding" {
  command = plan
  variables { enable_ai_cleanup = true }
  expect_failures = [azurerm_user_assigned_identity.badge_api]
}
