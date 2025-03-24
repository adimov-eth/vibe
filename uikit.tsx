"use client"

import type React from "react"

import { AnimatePresence, motion } from "framer-motion"
import {
    Bell,
    Calendar,
    ChevronRight,
    Heart,
    MessageCircle,
    Mic,
    Plus,
    Search,
    Settings,
    Sparkles,
    Star,
    User,
    X,
    Zap,
} from "lucide-react"
import { useState } from "react"

export default function VibeCheckUIKit() {
  const [activeTab, setActiveTab] = useState("components")
  const [selectedRadio, setSelectedRadio] = useState("option1")
  const [selectedToggle, setSelectedToggle] = useState(true)
  const [sliderValue, setSliderValue] = useState(70)

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F9F9F9] to-white text-[#333333] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#F0F0F0] px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Sparkles className="text-[#FF007A] h-5 w-5" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-[#FF007A] to-[#7C6DEB] text-transparent bg-clip-text">
            VibeCheck UI Kit
          </h1>
        </div>

        <motion.div
          className="w-10 h-10 rounded-full bg-gradient-to-r from-[#FF007A] to-[#7C6DEB] p-[2px] flex items-center justify-center"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <User className="w-5 h-5 text-[#555555]" />
          </div>
        </motion.div>
      </header>

      {/* Tab navigation */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex bg-[#F5F5F5] p-1 rounded-xl">
          {["components", "colors", "typography"].map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab ? "bg-white text-[#333333] shadow-sm" : "text-[#666666]"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6">
        <AnimatePresence mode="wait">
          {activeTab === "components" && (
            <motion.div
              key="components"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <ComponentsTab />
            </motion.div>
          )}

          {activeTab === "colors" && (
            <motion.div
              key="colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <ColorsTab />
            </motion.div>
          )}

          {activeTab === "typography" && (
            <motion.div
              key="typography"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <TypographyTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function ComponentsTab() {
  const [selectedRadio, setSelectedRadio] = useState("option1")
  const [selectedToggle, setSelectedToggle] = useState(true)
  const [sliderValue, setSliderValue] = useState(70)
  const [isRecording, setIsRecording] = useState(false)

  return (
    <div className="space-y-10">
      {/* Buttons section */}
      <Section title="Buttons">
        <div className="grid grid-cols-2 gap-4">
          <motion.button
            className="py-3 px-4 bg-gradient-to-r from-[#36D1DC] to-[#5B86E5] rounded-xl text-white font-medium shadow-sm"
            whileHover={{ scale: 1.03, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.97 }}
          >
            Primary Button
          </motion.button>

          <motion.button
            className="py-3 px-4 bg-white border border-[#F0F0F0] rounded-xl text-[#333333] font-medium shadow-sm"
            whileHover={{ scale: 1.03, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)" }}
            whileTap={{ scale: 0.97 }}
          >
            Secondary Button
          </motion.button>

          <motion.button
            className="py-3 px-4 bg-gradient-to-r from-[#FF007A] to-[#7C6DEB] rounded-xl text-white font-medium shadow-sm"
            whileHover={{ scale: 1.03, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.97 }}
          >
            Accent Button
          </motion.button>

          <motion.button
            className="py-3 px-4 bg-[#F5F5F5] rounded-xl text-[#666666] font-medium"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Tertiary Button
          </motion.button>
        </div>

        <div className="flex justify-between mt-4">
          <motion.button
            className="w-12 h-12 rounded-full bg-gradient-to-r from-[#36D1DC] to-[#5B86E5] flex items-center justify-center shadow-md"
            whileHover={{ scale: 1.1, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
            whileTap={{ scale: 0.9 }}
          >
            <Plus className="text-white" />
          </motion.button>

          <motion.button
            className="w-16 h-16 rounded-full bg-gradient-to-r from-[#36D1DC] to-[#5B86E5] flex items-center justify-center shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsRecording(!isRecording)}
          >
            <AnimatePresence mode="wait">
              {isRecording ? (
                <motion.div
                  key="recording"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <X className="w-6 h-6 text-white" />
                </motion.div>
              ) : (
                <motion.div
                  key="mic"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <Mic className="w-6 h-6 text-white" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          <motion.button
            className="w-12 h-12 rounded-full bg-white border border-[#F0F0F0] flex items-center justify-center shadow-sm"
            whileHover={{ scale: 1.1, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)" }}
            whileTap={{ scale: 0.9 }}
          >
            <Heart className="text-[#FF007A]" size={20} />
          </motion.button>
        </div>
      </Section>

      {/* Cards section */}
      <Section title="Cards">
        <motion.div
          className="bg-white rounded-xl p-4 flex justify-between items-center mb-4 shadow-sm border border-[#F0F0F0]"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <div>
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#36D1DC] to-[#5B86E5] flex items-center justify-center mr-3 shadow-sm">
                <MessageCircle className="text-white" size={20} />
              </div>
              <div>
                <h3 className="font-medium text-[#333333]">Mediator</h3>
                <p className="text-xs text-[#666666]">Get balanced insights</p>
              </div>
            </div>
          </div>
          <motion.div
            className="w-6 h-6 rounded-full border-2 border-[#5B86E5] flex items-center justify-center"
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(91, 134, 229, 0)",
                "0 0 0 4px rgba(91, 134, 229, 0.1)",
                "0 0 0 0 rgba(91, 134, 229, 0)",
              ],
            }}
            transition={{
              repeat: Number.POSITIVE_INFINITY,
              duration: 2,
              ease: "easeInOut",
            }}
          >
            <div className="w-3 h-3 rounded-full bg-[#5B86E5]"></div>
          </motion.div>
        </motion.div>

        <motion.div
          className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#F0F0F0] mb-4"
          whileHover={{ scale: 1.02, y: -2 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <div className="h-32 bg-gradient-to-r from-[#36D1DC]/20 to-[#5B86E5]/20 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center">
              <Calendar className="text-[#5B86E5]" size={28} />
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-medium text-[#333333] mb-1">Card Title</h3>
            <p className="text-sm text-[#666666]">This is a sample card with an icon and description.</p>
          </div>
        </motion.div>

        <div className="flex gap-4">
          <motion.div
            className="flex-1 bg-white rounded-xl p-4 shadow-sm border border-[#F0F0F0] flex flex-col items-center"
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <div className="w-10 h-10 rounded-full bg-[#FF007A]/10 flex items-center justify-center mb-2">
              <Star className="text-[#FF007A]" size={20} />
            </div>
            <p className="text-xs text-center text-[#666666]">Feature One</p>
          </motion.div>

          <motion.div
            className="flex-1 bg-white rounded-xl p-4 shadow-sm border border-[#F0F0F0] flex flex-col items-center"
            whileHover={{ scale: 1.05, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <div className="w-10 h-10 rounded-full bg-[#5B86E5]/10 flex items-center justify-center mb-2">
              <Zap className="text-[#5B86E5]" size={20} />
            </div>
            <p className="text-xs text-center text-[#666666]">Feature Two</p>
          </motion.div>
        </div>
      </Section>

      {/* Form Elements */}
      <Section title="Form Elements">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[#666666] mb-2">Text Input</label>
            <div className="relative">
              <input
                type="text"
                className="w-full px-4 py-3 bg-white border border-[#F0F0F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B86E5]/20 focus:border-[#5B86E5] transition-all"
                placeholder="Enter text here"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Search className="text-[#999999]" size={18} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#666666] mb-2">Radio Buttons</label>
            <div className="space-y-2">
              {["option1", "option2", "option3"].map((option) => (
                <div key={option} className="flex items-center">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-[#5B86E5] flex items-center justify-center mr-3 cursor-pointer"
                    onClick={() => setSelectedRadio(option)}
                  >
                    {selectedRadio === option && (
                      <motion.div
                        className="w-2.5 h-2.5 rounded-full bg-[#5B86E5]"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      />
                    )}
                  </div>
                  <span className="text-sm text-[#333333]">
                    {option === "option1" ? "First Option" : option === "option2" ? "Second Option" : "Third Option"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#666666] mb-2">Toggle Switch</label>
            <div
              className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${
                selectedToggle ? "bg-[#5B86E5]" : "bg-[#E0E0E0]"
              }`}
              onClick={() => setSelectedToggle(!selectedToggle)}
            >
              <motion.div
                className="w-4 h-4 rounded-full bg-white shadow-sm"
                animate={{ x: selectedToggle ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#666666] mb-2">Slider: {sliderValue}%</label>
            <div className="relative h-6 flex items-center">
              <div className="absolute w-full h-1 bg-[#E0E0E0] rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#36D1DC] to-[#5B86E5]"
                  style={{ width: `${sliderValue}%` }}
                />
              </div>
              <motion.div
                className="absolute w-5 h-5 rounded-full bg-white border-2 border-[#5B86E5] cursor-pointer"
                style={{ left: `calc(${sliderValue}% - 10px)` }}
                drag="x"
                dragConstraints={{ left: -10, right: 290 }}
                dragElastic={0}
                dragMomentum={false}
                onDrag={(_, info) => {
                  const newValue = Math.max(0, Math.min(100, (info.point.x / 300) * 100))
                  setSliderValue(Math.round(newValue))
                }}
                whileDrag={{ scale: 1.2 }}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Lists & Navigation */}
      <Section title="Lists & Navigation">
        <div className="space-y-2 mb-4">
          {[
            { icon: <Bell size={18} />, text: "Notifications", count: 3 },
            { icon: <MessageCircle size={18} />, text: "Messages", count: 0 },
            { icon: <Settings size={18} />, text: "Settings", count: 0 },
          ].map((item, index) => (
            <motion.div
              key={index}
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#F0F0F0]"
              whileHover={{ x: 5, backgroundColor: "rgba(91, 134, 229, 0.05)" }}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-[#F5F5F5] flex items-center justify-center mr-3">
                  <div className="text-[#666666]">{item.icon}</div>
                </div>
                <span className="text-sm text-[#333333]">{item.text}</span>
              </div>
              <div className="flex items-center">
                {item.count > 0 && (
                  <div className="w-5 h-5 rounded-full bg-[#FF007A] text-white text-xs flex items-center justify-center mr-2">
                    {item.count}
                  </div>
                )}
                <ChevronRight size={16} className="text-[#999999]" />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="bg-white rounded-xl overflow-hidden shadow-sm">
          <div className="flex border-b border-[#F0F0F0]">
            {["Home", "Explore", "Saved"].map((tab, index) => (
              <div
                key={index}
                className={`flex-1 py-3 text-center text-sm ${
                  index === 0 ? "text-[#5B86E5] border-b-2 border-[#5B86E5]" : "text-[#666666]"
                }`}
              >
                {tab}
              </div>
            ))}
          </div>
          <div className="p-4 text-sm text-[#666666] text-center">Tab content goes here</div>
        </div>
      </Section>

      {/* Visualizations */}
      <Section title="Visualizations">
        <div className="space-y-4">
          <div className="h-32 bg-white rounded-xl p-4 shadow-sm border border-[#F0F0F0] relative overflow-hidden">
            <h3 className="text-sm font-medium text-[#333333] mb-2 relative z-10">Wave Visualization</h3>
            <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#5B86E5" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#36D1DC" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <path
                d="M0,50 C30,40 70,60 100,50 C130,40 170,60 200,50 C230,40 270,60 300,50 C330,40 370,60 400,50 L400,100 L0,100 Z"
                fill="url(#waveGradient)"
              />
            </svg>
          </div>

          <div className="h-32 bg-white rounded-xl p-4 shadow-sm border border-[#F0F0F0] relative overflow-hidden">
            <h3 className="text-sm font-medium text-[#333333] mb-2 relative z-10">Blob Visualization</h3>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="blobGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(54, 209, 220, 0.3)" />
                  <stop offset="100%" stopColor="rgba(91, 134, 229, 0.3)" />
                </linearGradient>
              </defs>
              <path
                d="M50,10 Q65,5 75,15 Q90,30 85,50 Q80,65 70,75 Q55,90 40,80 Q20,70 15,55 Q10,35 25,20 Q35,10 50,10 Z"
                fill="url(#blobGradient)"
              />
            </svg>
          </div>
        </div>
      </Section>
    </div>
  )
}

function ColorsTab() {
  const colorGroups = [
    {
      name: "Primary",
      colors: [
        { name: "Blue 100", hex: "#E6F0FF", bg: "bg-[#E6F0FF]", text: "text-[#333333]" },
        { name: "Blue 200", hex: "#B3D1FF", bg: "bg-[#B3D1FF]", text: "text-[#333333]" },
        { name: "Blue 300", hex: "#80B3FF", bg: "bg-[#80B3FF]", text: "text-[#333333]" },
        { name: "Blue 400", hex: "#5B86E5", bg: "bg-[#5B86E5]", text: "text-white" },
        { name: "Blue 500", hex: "#3366CC", bg: "bg-[#3366CC]", text: "text-white" },
      ],
    },
    {
      name: "Secondary",
      colors: [
        { name: "Teal 100", hex: "#E6FFFD", bg: "bg-[#E6FFFD]", text: "text-[#333333]" },
        { name: "Teal 200", hex: "#B3FFF9", bg: "bg-[#B3FFF9]", text: "text-[#333333]" },
        { name: "Teal 300", hex: "#80FFF5", bg: "bg-[#80FFF5]", text: "text-[#333333]" },
        { name: "Teal 400", hex: "#36D1DC", bg: "bg-[#36D1DC]", text: "text-white" },
        { name: "Teal 500", hex: "#00B3B3", bg: "bg-[#00B3B3]", text: "text-white" },
      ],
    },
    {
      name: "Accent",
      colors: [
        { name: "Pink 100", hex: "#FFE6F0", bg: "bg-[#FFE6F0]", text: "text-[#333333]" },
        { name: "Pink 200", hex: "#FFB3D9", bg: "bg-[#FFB3D9]", text: "text-[#333333]" },
        { name: "Pink 300", hex: "#FF80C3", bg: "bg-[#FF80C3]", text: "text-white" },
        { name: "Pink 400", hex: "#FF007A", bg: "bg-[#FF007A]", text: "text-white" },
        { name: "Pink 500", hex: "#CC0062", bg: "bg-[#CC0062]", text: "text-white" },
      ],
    },
    {
      name: "Neutral",
      colors: [
        { name: "Gray 100", hex: "#F9F9F9", bg: "bg-[#F9F9F9]", text: "text-[#333333]" },
        { name: "Gray 200", hex: "#F0F0F0", bg: "bg-[#F0F0F0]", text: "text-[#333333]" },
        { name: "Gray 300", hex: "#E0E0E0", bg: "bg-[#E0E0E0]", text: "text-[#333333]" },
        { name: "Gray 400", hex: "#999999", bg: "bg-[#999999]", text: "text-white" },
        { name: "Gray 500", hex: "#666666", bg: "bg-[#666666]", text: "text-white" },
        { name: "Gray 600", hex: "#333333", bg: "bg-[#333333]", text: "text-white" },
      ],
    },
  ]

  return (
    <div className="space-y-8">
      <Section title="Color Palette">
        <p className="text-sm text-[#666666] mb-6">
          Our color system uses a light, friendly palette with gradients for a cozy, inviting feel.
        </p>

        {colorGroups.map((group) => (
          <div key={group.name} className="mb-6">
            <h3 className="text-sm font-medium text-[#333333] mb-3">{group.name}</h3>
            <div className="grid grid-cols-2 gap-3">
              {group.colors.map((color) => (
                <div key={color.name} className={`${color.bg} rounded-lg p-3 flex flex-col h-24 justify-between`}>
                  <span className={`text-xs font-medium ${color.text}`}>{color.name}</span>
                  <span className={`text-xs ${color.text}`}>{color.hex}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      <Section title="Gradients">
        <div className="grid grid-cols-1 gap-4">
          <div className="h-24 bg-gradient-to-r from-[#36D1DC] to-[#5B86E5] rounded-lg p-3 flex flex-col justify-between">
            <span className="text-xs font-medium text-white">Primary Gradient</span>
            <span className="text-xs text-white">from-[#36D1DC] to-[#5B86E5]</span>
          </div>

          <div className="h-24 bg-gradient-to-r from-[#FF007A] to-[#7C6DEB] rounded-lg p-3 flex flex-col justify-between">
            <span className="text-xs font-medium text-white">Accent Gradient</span>
            <span className="text-xs text-white">from-[#FF007A] to-[#7C6DEB]</span>
          </div>

          <div className="h-24 bg-gradient-to-b from-[#F9F9F9] to-white rounded-lg p-3 flex flex-col justify-between border border-[#F0F0F0]">
            <span className="text-xs font-medium text-[#333333]">Background Gradient</span>
            <span className="text-xs text-[#666666]">from-[#F9F9F9] to-white</span>
          </div>
        </div>
      </Section>
    </div>
  )
}

function TypographyTab() {
  return (
    <div className="space-y-8">
      <Section title="Typography">
        <p className="text-sm text-[#666666] mb-6">
          Our typography system uses a clean, readable hierarchy with careful attention to weight and spacing.
        </p>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#666666]">Heading 1</span>
              <span className="text-xs text-[#999999]">2xl / Bold</span>
            </div>
            <h1 className="text-2xl font-bold text-[#333333]">The quick brown fox jumps over the lazy dog</h1>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#666666]">Heading 2</span>
              <span className="text-xs text-[#999999]">xl / Bold</span>
            </div>
            <h2 className="text-xl font-bold text-[#333333]">The quick brown fox jumps over the lazy dog</h2>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#666666]">Heading 3</span>
              <span className="text-xs text-[#999999]">lg / Medium</span>
            </div>
            <h3 className="text-lg font-medium text-[#333333]">The quick brown fox jumps over the lazy dog</h3>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#666666]">Body</span>
              <span className="text-xs text-[#999999]">base / Regular</span>
            </div>
            <p className="text-base text-[#333333]">
              The quick brown fox jumps over the lazy dog. This is a paragraph of text that demonstrates the body style
              used throughout the application.
            </p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#666666]">Small / Caption</span>
              <span className="text-xs text-[#999999]">sm / Regular</span>
            </div>
            <p className="text-sm text-[#666666]">The quick brown fox jumps over the lazy dog</p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-[#666666]">Extra Small</span>
              <span className="text-xs text-[#999999]">xs / Regular</span>
            </div>
            <p className="text-xs text-[#999999]">The quick brown fox jumps over the lazy dog</p>
          </div>
        </div>
      </Section>

      <Section title="Text Styles">
        <div className="space-y-4">
          <div>
            <span className="text-xs text-[#666666] block mb-2">Gradient Text</span>
            <h3 className="text-xl font-bold bg-gradient-to-r from-[#FF007A] to-[#7C6DEB] text-transparent bg-clip-text">
              Gradient Text Example
            </h3>
          </div>

          <div>
            <span className="text-xs text-[#666666] block mb-2">Link Text</span>
            <a href="#" className="text-[#5B86E5] hover:underline">
              This is a link example
            </a>
          </div>

          <div>
            <span className="text-xs text-[#666666] block mb-2">Error Text</span>
            <p className="text-sm text-[#FF007A]">This is an error message</p>
          </div>

          <div>
            <span className="text-xs text-[#666666] block mb-2">Success Text</span>
            <p className="text-sm text-[#00B3B3]">This is a success message</p>
          </div>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-medium text-[#333333] mb-4">{title}</h2>
      {children}
    </section>
  )
}

