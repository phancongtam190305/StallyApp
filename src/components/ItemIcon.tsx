import React from "react";
import { 
  ChefHat, 
  Beef, 
  Salad, 
  Droplet, 
  Utensils, 
  Apple, 
  Soup, 
  Package,
  LucideProps
} from "lucide-react";

interface ItemIconProps {
  name: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export default function ItemIcon({ name, className = "", size = "md" }: ItemIconProps) {
  const lowerName = name.toLowerCase();
  
  let IconComponent: React.ComponentType<LucideProps> = Package;
  let bgClass = "bg-slate-50 text-slate-500 border-slate-200/60";
  
  if (lowerName.includes("gạo") || lowerName.includes("st25") || lowerName.includes("rice")) {
    IconComponent = ChefHat;
    bgClass = "bg-amber-50 text-amber-700 border-amber-200/50";
  } else if (lowerName.includes("rau") || lowerName.includes("lách") || lowerName.includes("salad") || lowerName.includes("củ") || lowerName.includes("organ")) {
    IconComponent = Salad;
    bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
  } else if (lowerName.includes("thịt") || lowerName.includes("bò") || lowerName.includes("slicing") || lowerName.includes("heo") || lowerName.includes("chicken") || lowerName.includes("beef")) {
    IconComponent = Beef;
    bgClass = "bg-rose-50 text-rose-700 border-rose-200/50";
  } else if (lowerName.includes("dầu") || lowerName.includes("an") || lowerName.includes("chai") || lowerName.includes("nước") || lowerName.includes("oil") || lowerName.includes("mắm")) {
    IconComponent = Droplet;
    bgClass = "bg-amber-50 text-accent-dark border-amber-200/50";
  } else if (lowerName.includes("chén") || lowerName.includes("dĩa") || lowerName.includes("bát") || lowerName.includes("sứ") || lowerName.includes("minh long") || lowerName.includes("utensil")) {
    IconComponent = Utensils;
    bgClass = "bg-indigo-50 text-indigo-750 border-indigo-200/50";
  } else if (lowerName.includes("trái") || lowerName.includes("quả") || lowerName.includes("fruit") || lowerName.includes("táo") || lowerName.includes("cam")) {
    IconComponent = Apple;
    bgClass = "bg-orange-50 text-orange-700 border-orange-200/50";
  } else if (lowerName.includes("vị") || lowerName.includes("soup") || lowerName.includes("bột") || lowerName.includes("đường") || lowerName.includes("muối") || lowerName.includes("hạt nêm")) {
    IconComponent = Soup;
    bgClass = "bg-yellow-50 text-yellow-750 border-yellow-250/50";
  }

  const paddingClass = size === "sm" ? "p-1 rounded-md" : size === "lg" ? "p-2 rounded-2xl" : "p-1.5 rounded-xl";
  const iconSizeClass = size === "sm" ? "w-3 h-3" : size === "lg" ? "w-5 h-5" : "w-4 h-4";

  return (
    <div className={`inline-flex items-center justify-center border shrink-0 ${bgClass} ${paddingClass} ${className}`}>
      <IconComponent className={iconSizeClass} />
    </div>
  );
}
