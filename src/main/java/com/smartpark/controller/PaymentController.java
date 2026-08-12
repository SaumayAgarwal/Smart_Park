package com.smartpark.controller;

import com.smartpark.dto.ApiResponse;
import com.smartpark.dto.payment.PaymentRequest;
import com.smartpark.dto.payment.PaymentResponse;
import com.smartpark.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@PreAuthorize("hasRole('DRIVER')")
public class PaymentController {

    private final PaymentService paymentService;

    @PostMapping
    public ResponseEntity<ApiResponse<PaymentResponse>> processPayment(
            @Valid @RequestBody PaymentRequest request,
            Principal principal) {

        try {
            PaymentResponse response = paymentService.processPayment(request, principal.getName());
            return ResponseEntity.ok(ApiResponse.<PaymentResponse>builder()
                    .success(true)
                    .message("Payment processed successfully")
                    .data(response)
                    .build());
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.<PaymentResponse>builder()
                    .success(false)
                    .message(e.getMessage())
                    .build());
        }
    }
}