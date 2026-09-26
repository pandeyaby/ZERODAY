package com.example;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class OrderService {
    private static final Logger log = LogManager.getLogger(OrderService.class);

    public void place(String userAgent) {
        log.info("Order placed from {}", userAgent);
    }
}
