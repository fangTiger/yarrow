async (page) => {
  await page.route("https://rpc.testnet.arc.io/**", async (route) => {
    const payload = route.request().postDataJSON();
    const requests = Array.isArray(payload) ? payload : [payload];
    const responses = [];
    for (const request of requests) {
      try {
        const result = await page.evaluate(
          ({ method, params }) => window.ethereum.request({ method, params }),
          { method: request.method, params: request.params ?? [] },
        );
        responses.push({ jsonrpc: "2.0", id: request.id, result });
      } catch (error) {
        responses.push({
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32603, message: error instanceof Error ? error.message : "mock RPC 调用失败" },
        });
      }
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(Array.isArray(payload) ? responses : responses[0]),
    });
  });
}
