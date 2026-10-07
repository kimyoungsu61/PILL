package com.pill.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class WebAppHeaders extends OncePerRequestFilter {
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        var path=request.getRequestURI();
        if(path.equals("/") || path.equals("/index.html") || path.equals("/sw.js") || path.equals("/manifest.webmanifest")) response.setHeader("Cache-Control","no-store");
        if(path.equals("/sw.js")) response.setHeader("Service-Worker-Allowed","/");
        chain.doFilter(request,response);
    }
}
