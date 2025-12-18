"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { TextAnimate } from '@/components/ui/text-animate';
import { Ripple } from '@/components/ui/ripple';
import Link from 'next/link';

interface CtaSectionProps {
  className?: string;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ className = '' }) => {
  return (
    <div className={`CtaSection py-16 md:py-24 lg:py-32 overflow-hidden ${className}`} style={{ position: 'relative' }} data-cta-section>
      {/* Dot Pattern Background - Square Container */}
      <div className="absolute inset-0 flex items-center justify-center z-0">
      </div>
      
      {/* Ripple Effect Background */}
      <div className="absolute inset-0 z-0">
        <Ripple 
          mainCircleSize={200}
          mainCircleOpacity={0.3}
          numCircles={6}
          className="opacity-100"
        />
      </div>
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Big Headline */}
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium text-center tracking-tight mb-6 sm:mb-8">
          <TextAnimate
            by="word"
            animation="blurInUp"
            delay={0.1}
            duration={0.8}
            className="inline text-primary"
          >
            Ready to get things done?
          </TextAnimate>
        </h1>
        
        {/* Subtitle */}
        <h2 className="text-xl sm:text-2xl md:text-3xl font-medium text-center text-muted-foreground mb-8 sm:mb-12 max-w-3xl mx-auto px-4 leading-relaxed">
          <TextAnimate
            by="word"
            animation="fadeIn"
            delay={0.5}
            duration={0.6}
            className="inline"
          >
            Join thousands of teams already using Workedge to manage their tasks and boost productivity.
          </TextAnimate>
        </h2>
        
        {/* Action Button */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center px-4">
          <Button
            size="lg"
            className="group px-8 py-4 text-lg font-medium bg-primary hover:bg-primary/90 shadow-lg"
            asChild
          >
            <Link href="/dashboard">
              Get Started Free
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
