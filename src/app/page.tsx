import { BuySection } from '~/modules/landing/components/BuySection'
import { FaqSection } from '~/modules/landing/components/FaqSection'
import { FeaturesSection } from '~/modules/landing/components/FeaturesSection'
import { HeroSection } from '~/modules/landing/components/HeroSection'
import { LandingFooter } from '~/modules/landing/components/LandingFooter'
import { LandingHeader } from '~/modules/landing/components/LandingHeader'
import { PlatformSupport } from '~/modules/landing/components/PlatformSupport'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-text">
      <LandingHeader />
      <HeroSection />
      <PlatformSupport />
      <FeaturesSection />
      <BuySection />
      <FaqSection />
      <LandingFooter />
    </div>
  )
}
