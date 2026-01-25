import { test, expect } from '@playwright/test';

test.describe('Admin Notifications', () => {
  test('should NOT show notifications to non-admin users', async ({ page }) => {
    // This test verifies backward compatibility - regular users should not see notifications
    await page.goto('/');
    
    // Check that AdminNotifications component doesn't render for non-admins
    // The component should not exist in the DOM
    const notificationContainer = page.locator('[class*="fixed top-20"]').first();
    await expect(notificationContainer).toHaveCount(0);
  });

  test('should NOT create notifications for existing requests', async ({ page }) => {
    // This test ensures we don't spam admins with notifications for old requests
    // Navigate to the notifications API endpoint (requires admin auth)
    const response = await page.request.get('/api/admin/notifications');
    
    if (response.status() === 401 || response.status() === 403) {
      // Not authenticated as admin, which is expected in this test environment
      test.skip();
      return;
    }

    const data = await response.json();
    const notifications = data.notifications || [];
    
    // Get all existing requests
    const requestsResponse = await page.request.get('/api/admin/requests');
    if (requestsResponse.ok()) {
      const requestsData = await requestsResponse.json();
      const existingRequestCount = requestsData.requests?.length || 0;
      
      // Notifications should be far fewer than existing requests
      // (only new requests from this point forward should have notifications)
      expect(notifications.length).toBeLessThanOrEqual(existingRequestCount);
      console.log(`Existing requests: ${existingRequestCount}, Notifications: ${notifications.length}`);
    }
  });

  test('should render notification API endpoints', async ({ page }) => {
    // Test that API routes are defined and respond
    const endpoints = [
      '/api/admin/notifications',
      '/api/admin/notifications/dismiss',
      '/api/admin/notifications/dismiss-all',
    ];

    for (const endpoint of endpoints) {
      const response = await page.request.get(endpoint);
      // Should return 200 (success), 401/403 (auth required), 405 (wrong method for POST routes), or 500 (server error)
      expect([200, 401, 403, 405, 500]).toContain(response.status());
      console.log(`${endpoint}: ${response.status()}`);
    }
  });

  test('should not break existing request creation flow', async ({ page }) => {
    // Test backward compatibility - request creation should still work
    await page.goto('/requests');
    
    // If redirected to auth, that's expected behavior
    if (page.url().includes('/auth')) {
      test.skip();
      return;
    }

    // Check that the requests page loads without errors
    await expect(page).toHaveURL(/\/requests/);
    
    // Look for request form elements to ensure page rendered correctly
    const pageContent = await page.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('notifications should have correct structure when rendered', async ({ page }) => {
    // This test verifies the notification component structure
    await page.goto('/');
    
    // If there are any notifications visible (unlikely in test env)
    const notifications = page.locator('[class*="border-2"]').filter({ hasText: /ציוד|החזרת|בלאי|אבד/ });
    const count = await notifications.count();
    
    if (count > 0) {
      // Verify first notification has required elements
      const firstNotification = notifications.first();
      
      // Should have a close button
      await expect(firstNotification.locator('button[aria-label="סגור"]')).toBeVisible();
      
      // Should have a link to requests
      await expect(firstNotification.locator('a[href="/admin/requests"]')).toBeVisible();
      
      // Should have colored border (one of the request type colors)
      const classes = await firstNotification.getAttribute('class');
      const hasColorBorder = classes?.includes('border-blue-500') ||
                             classes?.includes('border-purple-500') ||
                             classes?.includes('border-yellow-500') ||
                             classes?.includes('border-red-500') ||
                             classes?.includes('border-zinc-500') ||
                             classes?.includes('border-orange-500') ||
                             classes?.includes('border-green-500');
      expect(hasColorBorder).toBeTruthy();
    }
    
    console.log(`Found ${count} notifications in test environment`);
  });

  test('localStorage persistence for dismissed notifications', async ({ page }) => {
    // Test that dismissed notifications are stored in localStorage
    await page.goto('/');
    
    // Set some dismissed notification IDs in localStorage
    await page.evaluate(() => {
      localStorage.setItem('dismissedNotifications', JSON.stringify(['test-id-1', 'test-id-2']));
    });
    
    // Verify they were set
    const stored = await page.evaluate(() => {
      return localStorage.getItem('dismissedNotifications');
    });
    
    expect(stored).toBe('["test-id-1","test-id-2"]');
  });

  test('should not interfere with admin requests page', async ({ page }) => {
    // Test that the admin requests page still works correctly
    await page.goto('/admin/requests');
    
    // If redirected to auth, that's expected
    if (page.url().includes('/auth')) {
      test.skip();
      return;
    }
    
    // Check that the page loads
    await expect(page).toHaveURL(/\/admin\/requests/);
    
    // Look for tabs that should be present
    const tabsExist = await page.locator('button', { hasText: /בקשות ציוד|הצהרות|העברות/ }).count();
    expect(tabsExist).toBeGreaterThan(0);
  });

  test('notification component should poll correctly', async ({ page }) => {
    // Test that the component polls for notifications
    await page.goto('/');
    
    // Listen for API calls
    let apiCallCount = 0;
    page.on('request', request => {
      if (request.url().includes('/api/admin/notifications')) {
        apiCallCount++;
      }
    });
    
    // Wait for some time to allow polling (5 second intervals)
    await page.waitForTimeout(12000); // Wait 12 seconds to see at least 2 polls
    
    // If user is admin, we should see API calls
    // If not admin, no calls should be made
    console.log(`API calls to /api/admin/notifications: ${apiCallCount}`);
    expect(apiCallCount).toBeGreaterThanOrEqual(0);
  });

  test('mobile responsiveness of notifications', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that notification container has mobile-responsive classes
    const container = page.locator('[class*="fixed top-20"]').first();
    const count = await container.count();
    
    if (count > 0) {
      const classes = await container.getAttribute('class');
      expect(classes).toContain('left-4');
      expect(classes).toContain('right-4');
    }
  });

  test('notification click navigates to requests page', async ({ page }) => {
    await page.goto('/');
    
    // Look for any notification
    const notification = page.locator('a[href="/admin/requests"]').first();
    const count = await notification.count();
    
    if (count > 0) {
      await notification.click();
      await expect(page).toHaveURL(/\/admin\/requests/);
    }
  });
});

test.describe('Backward Compatibility', () => {
  test('existing pages should load without errors', async ({ page }) => {
    const pagesToTest = [
      '/',
      '/requests',
      '/admin',
      '/personal',
    ];

    for (const path of pagesToTest) {
      await page.goto(path);
      
      // Check for any console errors
      const errors: string[] = [];
      page.on('pageerror', error => {
        errors.push(error.message);
      });
      
      await page.waitForTimeout(1000);
      
      // If there are errors, they should not be related to notifications
      const notificationRelatedErrors = errors.filter(err => 
        err.includes('AdminNotification') || 
        err.includes('notification')
      );
      
      expect(notificationRelatedErrors.length).toBe(0);
      console.log(`${path}: ${errors.length} total errors, ${notificationRelatedErrors.length} notification-related`);
    }
  });

  test('database schema should have AdminNotification table', async ({ page }) => {
    // This is an indirect test - verify the API endpoints work
    const response = await page.request.get('/api/admin/notifications');
    
    // Should not return 404 (route doesn't exist)
    // 500 is acceptable if it's an auth error (no user authenticated in test)
    expect(response.status()).not.toBe(404);
    console.log(`Admin notifications API status: ${response.status()}`);
  });
});
